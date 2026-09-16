export const PRIVILEGED_SERVER_COMMANDS = new Set([
  'tp',
  'teleport',
  'setblock',
  'give',
  'time',
  'weather',
  'gamemode',
  'gm',
]);

export function normalizeCommandLabel(commandText: string): string {
  const trimmed = commandText.trim();
  if (!trimmed.startsWith('/')) return '';
  return trimmed.slice(1).split(/\s+/, 1)[0]?.toLowerCase() ?? '';
}

/** Multiplayer clients do not gain operator authority merely by sending slash commands. */
export function canExecuteServerCommand(commandText: string, isOperator: boolean): boolean {
  const label = normalizeCommandLabel(commandText);
  if (!label) return false;
  return isOperator && PRIVILEGED_SERVER_COMMANDS.has(label);
}

export function isValidWeatherArgument(value: unknown): value is 'clear' | 'rain' | 'thunder' {
  return value === 'clear' || value === 'rain' || value === 'thunder';
}

export function clampGiveCount(count: unknown, maxStackSize: number): number | null {
  const parsed = Number(count);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed <= 0) return null;
  return Math.min(parsed, Math.max(1, Math.floor(maxStackSize)));
}
