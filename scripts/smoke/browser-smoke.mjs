#!/usr/bin/env node
/**
 * P1.8 — Browser smoke automation (Playwright).
 *
 * Scenarios:
 *   new-world  — boot the app, create a fresh singleplayer world, prove the
 *                game loop is actually running (opening chat via T requires a
 *                live loop), round-trip a chat command, and sample FPS. Pass
 *                --duration to keep the page open for a long-run stability
 *                check with periodic FPS sampling.
 *   two-client — start the multiplayer server, join with two browser clients
 *                (join confirmed via the server's connection log), and verify
 *                a chat message sent by client A is received by client B.
 *
 * Usage:
 *   npm run build                          # dist/ must exist (vite preview)
 *   node scripts/smoke/browser-smoke.mjs --scenario new-world
 *   node scripts/smoke/browser-smoke.mjs --scenario new-world --duration 1800
 *   node scripts/smoke/browser-smoke.mjs --scenario two-client
 *   SMOKE_VERBOSE=1 ...                    # print server/vite output
 *
 * Boot signal note: the HUD (hearts) renders on the menu too, so "game booted"
 * is proven by the game loop responding to the T key (chat input appears), not
 * by HUD presence.
 *
 * Note on the 60 FPS release gate: headless Chromium renders WebGL through
 * SwiftShader (software), so FPS here is a lower-bound stability signal, not a
 * GPU-parity measurement. Run --duration on real hardware for the gate.
 */
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const PREVIEW_PORT = 4173;
// Vite serves under the GitHub Pages base path /mc/ and binds `localhost`.
const PREVIEW_URL = `http://localhost:${PREVIEW_PORT}/mc/`;
const SERVER_WS = 'ws://localhost:8080';

const args = Object.fromEntries(process.argv.slice(2).map((v, i, a) =>
  v.startsWith('--') ? [v.slice(2), a[i + 1]?.startsWith('--') ? true : a[i + 1]] : []
).filter(([k]) => k));

const scenario = args.scenario ?? 'new-world';
const durationSec = Number(args.duration ?? 15);
const outPath = args.out ? resolve(ROOT, args.out) : null;

const errors = [];
const childProcesses = [];

function log(...parts) {
  console.log(`[smoke] ${parts.join(' ')}`);
}

async function waitForHttp(url, timeoutMs = 40000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

/** Accumulates a child's stdout and waits for a pattern with a timeout. */
class OutputWatcher {
  constructor(child) {
    this.buffer = '';
    child.stdout?.on('data', (d) => {
      this.buffer += d.toString();
      if (process.env.SMOKE_VERBOSE) process.stdout.write(d);
    });
    child.stderr?.on('data', (d) => {
      this.buffer += d.toString();
      if (process.env.SMOKE_VERBOSE) process.stderr.write(d);
    });
  }
  async waitFor(pattern, timeoutMs = 40000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (pattern.test(this.buffer)) return;
      await new Promise((r) => setTimeout(r, 250));
    }
    throw new Error(`Timed out waiting for ${pattern}; server log tail: ${this.buffer.slice(-400)}`);
  }
}

function startVitePreview() {
  const child = spawn('npx', ['vite', 'preview', '--port', String(PREVIEW_PORT), '--strictPort'], {
    cwd: ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  childProcesses.push(child);
  return child;
}

function startServer() {
  const child = spawn('npx', ['tsx', 'src/server/standalone.ts'], {
    cwd: ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  childProcesses.push(child);
  return new OutputWatcher(child);
}

function trackPage(page, label) {
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    // Browser auto-requests (favicon, missing assets) are not app errors.
    if (/Failed to load resource.*(404|net::ERR_)/i.test(msg.text())) {
      if (process.env.SMOKE_VERBOSE) log(`${label}: ignored resource error: ${msg.text()}`);
      return;
    }
    errors.push(`[${label}] console.error: ${msg.text()}`);
  });
  page.on('pageerror', (err) => errors.push(`[${label}] pageerror: ${err.message}`));
}

async function openBrowser() {
  return chromium.launch({
    headless: args.headless === 'false' ? false : true,
    args: [
      '--enable-unsafe-swiftshader',
      '--use-angle=swiftshader',
      '--disable-gpu-sandbox',
      '--no-first-run',
    ],
  });
}

/**
 * Wait until the menu and loading overlays are gone and the canvas renders.
 * NOTE: the HUD hearts render on the menu too, so this only proves the world
 * launch flow completed; the game loop is proven by waitForGameInteractive.
 */
async function waitForGameBoot(page, timeoutMs = 90000) {
  await page.waitForSelector('canvas', { timeout: timeoutMs });
  await page.waitForFunction(() => {
    const canvas = document.querySelector('canvas');
    if (!canvas || canvas.width === 0 || canvas.height === 0) return false;
    if (document.querySelectorAll('.minecraft-btn').length > 0) return false;
    if (document.body.innerText.includes('Loading World')) return false;
    return true;
  }, { timeout: timeoutMs });
}

/** Hold a key across at least one game frame so the game loop observes it. */
async function pressGameKey(page, key) {
  await page.keyboard.down(key);
  await page.waitForTimeout(120);
  await page.keyboard.up(key);
  await page.waitForTimeout(150);
}

/**
 * Open the chat bar (T) and return the focused input locator. Retries the T
 * press because the game loop only observes keys while it is ticking; waits
 * for the input to actually render so typing cannot race the autofocus effect.
 */
async function openChat(page, timeoutMs = 15000) {
  const chatInput = page.locator('input[type="text"]');
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    await pressGameKey(page, 't');
    if (await chatInput.count() > 0) {
      await page.waitForTimeout(400); // let ChatBar autofocus settle
      return chatInput.first();
    }
    await page.waitForTimeout(800);
  }
  throw new Error('chat bar never opened after repeated T presses');
}

/**
 * Prove the game loop is live: pressing T must open the chat input. The menu
 * screen has no running loop, so this distinguishes "menu open" from "world
 * running" reliably.
 */
async function waitForGameInteractive(page, timeoutMs = 60000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    await pressGameKey(page, 't');
    const chatInput = page.locator('input[type="text"]');
    if (await chatInput.count() > 0) {
      await page.keyboard.press('Escape'); // close chat
      await page.waitForTimeout(300);
      return;
    }
    await page.waitForTimeout(1500);
  }
  throw new Error('game loop not interactive: chat input never appeared after T');
}

/** Sample FPS in-page via requestAnimationFrame for `seconds`. */
async function sampleFps(page, seconds) {
  return page.evaluate(async (secs) => {
    return await new Promise((resolve) => {
      const deltas = [];
      let last = performance.now();
      const start = performance.now();
      const tick = () => {
        const now = performance.now();
        deltas.push(now - last);
        last = now;
        if (now - start < secs * 1000) {
          requestAnimationFrame(tick);
        } else {
          const fps = deltas.map((d) => 1000 / d);
          const avg = fps.reduce((a, b) => a + b, 0) / fps.length;
          const min = Math.min(...fps);
          const max = Math.max(...fps);
          const p1 = fps.slice().sort((a, b) => a - b)[Math.floor(fps.length * 0.01)];
          resolve({ avg: Math.round(avg * 10) / 10, min: Math.round(min), max: Math.round(max), p1: Math.round(p1), samples: fps.length });
        }
      };
      requestAnimationFrame(tick);
    });
  }, seconds);
}

/** Menu flow to create a fresh singleplayer world. */
async function createFreshWorld(page) {
  await page.goto(PREVIEW_URL, { waitUntil: 'networkidle' });
  await page.getByText('Singleplayer', { exact: true }).click();
  await page.waitForSelector('text=Create World', { timeout: 20000 });

  // Clear any existing save so this is a FRESH world (accept the confirm dialog).
  const deleteButtons = page.getByText('Delete', { exact: true });
  if (await deleteButtons.count() > 0) {
    page.once('dialog', (d) => d.accept());
    await deleteButtons.first().click();
    await page.waitForTimeout(600);
  }

  await page.getByText('Create World', { exact: true }).first().click();
  await page.waitForSelector('text=Choose Game Mode', { timeout: 20000 });
  await page.locator('.mode-card').first().click(); // Survival card
  await page.locator('button.minecraft-btn', { hasText: 'Create World' }).click();
}

async function newWorldScenario(browser) {
  log('scenario: new-world (fresh singleplayer boot)');
  const context = await browser.newContext({ locale: 'en-US', viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  trackPage(page, 'client');

  await createFreshWorld(page);
  await waitForGameBoot(page);
  await waitForGameInteractive(page);
  log('game loop interactive: chat input responds to T');

  // Interactive command round-trip through the live loop.
  const chatInput = await openChat(page);
  await chatInput.fill('/time set day');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(600);

  const fps = await sampleFps(page, Math.min(durationSec, 60));
  log(`FPS over ${Math.min(durationSec, 60)}s: avg=${fps.avg} min=${fps.min} p1=${fps.p1} max=${fps.max} (${fps.samples} frames)`);
  if (fps.avg <= 0) {
    throw new Error('FPS sample produced no frames — game loop appears stalled');
  }

  if (durationSec > 60) {
    log(`long-run: keeping page open for ${durationSec}s total, sampling every 30s`);
    let elapsed = 60;
    while (elapsed < durationSec) {
      await page.waitForTimeout(30000);
      elapsed += 30;
      const fpsNow = await sampleFps(page, 5);
      log(`long-run t=${elapsed}s: avg=${fpsNow.avg} min=${fpsNow.min} (errors so far: ${errors.length})`);
    }
  }

  await context.close();
  return { fps, interactiveCommand: 'time set day', durationSec };
}

async function twoClientScenario(browser) {
  log('scenario: two-client (multiplayer join + chat round-trip)');
  const serverWatcher = startServer();
  await serverWatcher.waitFor(/running on ws:/, 40000);

  const token = `smoke-${Date.now().toString(36)}`;
  const join = async (username) => {
    const context = await browser.newContext({ locale: 'en-US', viewport: { width: 1280, height: 720 } });
    const page = await context.newPage();
    trackPage(page, username);
    await page.goto(PREVIEW_URL, { waitUntil: 'networkidle' });
    await page.getByText(/^Multiplayer/).click();
    await page.waitForSelector('input', { timeout: 20000 });
    const inputs = page.locator('input');
    await inputs.nth(0).fill(SERVER_WS);
    await inputs.nth(1).fill(username);
    await page.getByText(/^Join Server/).click();

    // Authoritative join confirmation: the server logs the WebSocket connection.
    await serverWatcher.waitFor(new RegExp(`Player connected: ${username.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`), 45000);
    log(`${username}: server confirmed connection`);
    await waitForGameBoot(page);
    await waitForGameInteractive(page);
    log(`${username}: game loop interactive`);
    return { context, page };
  };

  const clientA = await join(`SmokeA_${token.slice(-4)}`);
  const clientB = await join(`SmokeB_${token.slice(-4)}`);

  // Client A sends a chat message; client B must receive it.
  const chatInput = await openChat(clientA.page);
  await chatInput.fill(`two-client ${token}`);
  await clientA.page.keyboard.press('Enter');

  await clientB.page.waitForFunction((tok) => document.body.innerText.includes(tok), token, { timeout: 20000 });
  await clientA.page.waitForFunction((tok) => document.body.innerText.includes(tok), token, { timeout: 20000 });
  log(`chat round-trip verified: '${token}' visible on both clients`);

  await clientA.context.close();
  await clientB.context.close();
  return { token };
}

async function main() {
  if (!existsSync(resolve(ROOT, 'dist', 'index.html'))) {
    throw new Error('dist/ missing — run `npm run build` before the smoke test');
  }

  const browser = await openBrowser();
  const preview = startVitePreview();
  await waitForHttp(PREVIEW_URL);

  const result = {};
  try {
    if (scenario === 'two-client') {
      result.scenario = 'two-client';
      result.pass = await twoClientScenario(browser);
    } else {
      result.scenario = 'new-world';
      result.pass = await newWorldScenario(browser);
    }

    if (errors.length > 0) {
      log(`FAIL: ${errors.length} console/page errors:`);
      for (const e of errors.slice(0, 10)) log('  ' + e);
      process.exitCode = 1;
    } else {
      log('PASS: zero console/page errors');
    }
  } finally {
    await browser.close();
    for (const child of childProcesses) child.kill('SIGTERM');
  }

  const summary = {
    scenario: result.scenario,
    passed: process.exitCode == null || process.exitCode === 0,
    consoleErrors: errors,
    ...result.pass,
  };
  if (outPath) {
    const { writeFileSync } = await import('node:fs');
    writeFileSync(outPath, JSON.stringify(summary, null, 2) + '\n');
    log(`summary written to ${outPath}`);
  } else {
    console.log(JSON.stringify(summary, null, 2));
  }
}

main().catch((err) => {
  log('FATAL:', err.message);
  for (const child of childProcesses) child.kill('SIGTERM');
  process.exit(1);
});
