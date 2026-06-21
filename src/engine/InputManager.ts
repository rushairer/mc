export class InputManager {
  keys: Set<string> = new Set();
  mouseButtons: Set<number> = new Set();
  mouseDeltaX = 0;
  mouseDeltaY = 0;
  scrollDelta = 0;
  locked = false;
  hasEverLocked = false;
  private lastSpacePressTime = 0;
  private spaceDoubleTapped = false;

  constructor(private canvas: HTMLCanvasElement) {
    document.addEventListener('keydown', this.onKeyDown);
    document.addEventListener('keyup', this.onKeyUp);
    document.addEventListener('mousedown', this.onMouseDown);
    document.addEventListener('mouseup', this.onMouseUp);
    document.addEventListener('mousemove', this.onMouseMove);
    document.addEventListener('wheel', this.onWheel);
    document.addEventListener('pointerlockchange', this.onLockChange);
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  requestLock() {
    try {
      const request = this.canvas.requestPointerLock();
      if (request && typeof request.catch === 'function') {
        request.catch(() => {
          // Browsers may reject pointer lock outside direct trusted gestures.
        });
      }
    } catch {
      // Some embedded browsers disallow pointer lock entirely.
    }
  }

  isKeyDown(key: string): boolean {
    return this.keys.has(key.toLowerCase());
  }

  isMouseDown(button: number): boolean {
    return this.mouseButtons.has(button);
  }

  consumeScroll(): number {
    const d = this.scrollDelta;
    this.scrollDelta = 0;
    return d;
  }

  consumeMouseDelta(): { dx: number; dy: number } {
    const dx = this.mouseDeltaX;
    const dy = this.mouseDeltaY;
    this.mouseDeltaX = 0;
    this.mouseDeltaY = 0;
    return { dx, dy };
  }

  consumeMouseClick(button: number): boolean {
    if (this.mouseButtons.has(button)) {
      this.mouseButtons.delete(button);
      return true;
    }
    return false;
  }

  consumeSpaceDoubleTap(): boolean {
    const tapped = this.spaceDoubleTapped;
    this.spaceDoubleTapped = false;
    return tapped;
  }

  private onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'F5') {
      e.preventDefault();
    }
    if (e.key === ' ' && !e.repeat) {
      const now = performance.now();
      if (now - this.lastSpacePressTime < 300) {
        this.spaceDoubleTapped = true;
      }
      this.lastSpacePressTime = now;
    }
    this.keys.add(e.key.toLowerCase());
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.key.toLowerCase());
  };

  private onMouseDown = (e: MouseEvent) => {
    this.mouseButtons.add(e.button);
  };

  private onMouseUp = (e: MouseEvent) => {
    this.mouseButtons.delete(e.button);
  };

  private onMouseMove = (e: MouseEvent) => {
    if (this.locked) {
      this.mouseDeltaX += e.movementX;
      this.mouseDeltaY += e.movementY;
    }
  };

  private onWheel = (e: WheelEvent) => {
    this.scrollDelta += e.deltaY > 0 ? 1 : -1;
  };

  private onLockChange = () => {
    this.locked = document.pointerLockElement === this.canvas;
    if (this.locked) this.hasEverLocked = true;
  };

  dispose() {
    document.removeEventListener('keydown', this.onKeyDown);
    document.removeEventListener('keyup', this.onKeyUp);
    document.removeEventListener('mousedown', this.onMouseDown);
    document.removeEventListener('mouseup', this.onMouseUp);
    document.removeEventListener('mousemove', this.onMouseMove);
    document.removeEventListener('wheel', this.onWheel);
    document.removeEventListener('pointerlockchange', this.onLockChange);
  }
}
