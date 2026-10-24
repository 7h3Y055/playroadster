/**
 * InputManager.ts — Keyboard & touch/swipe event mapping.
 * Provides a clean input state object consumed by Player and game systems.
 * Lane switches are edge-triggered; fly/boost are continuous.
 */

export interface InputState {
  /** Edge-triggered: true for ONE tick when lane-left pressed */
  left: boolean;
  /** Edge-triggered: true for ONE tick when lane-right pressed */
  right: boolean;
  /** Continuous: true while fly/jump key held */
  fly: boolean;
  /** Edge-triggered: true for ONE tick when slam pressed */
  slam: boolean;
  /** Continuous: true while boost key held */
  boost: boolean;
  /** Edge-triggered: true for ONE tick on any action press (for menu) */
  action: boolean;
  /** Edge-triggered: pause toggle */
  pause: boolean;
  /** Edge-triggered: mute toggle */
  mute: boolean;
}

export class InputManager {
  private readonly state: InputState = {
    left: false,
    right: false,
    fly: false,
    slam: false,
    boost: false,
    action: false,
    pause: false,
    mute: false,
  };

  /** Keys currently held down */
  private readonly keysDown = new Set<string>();

  /** Edge-triggered flags that need to be consumed (cleared after read) */
  private edgeLeft = false;
  private edgeRight = false;
  private edgeSlam = false;
  private edgeAction = false;
  private edgePause = false;
  private edgeMute = false;

  // ── Touch state ──────────────────────
  private touchStartX = 0;
  private touchStartY = 0;
  private touchActive = false;
  private touchFlying = false;
  private touchBoosting = false;
  private lastTouchTime = 0;
  private longPressTimer: number | null = null;

  private static readonly SWIPE_THRESHOLD = 26; // px
  private static readonly LONG_PRESS_DELAY = 220; // ms to activate rocket boost on hold

  constructor() {
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('touchstart', this._onTouchStart, { passive: false });
    window.addEventListener('touchmove', this._onTouchMove, { passive: false });
    window.addEventListener('touchend', this._onTouchEnd, { passive: false });
    window.addEventListener('touchcancel', this._onTouchEnd, { passive: false });
  }

  /**
   * Read current input state. Edge-triggered values are true for only one call,
   * then automatically reset. Call this ONCE per fixed tick.
   */
  public read(): Readonly<InputState> {
    // Edge-triggered — consume
    this.state.left = this.edgeLeft;
    this.state.right = this.edgeRight;
    this.state.slam = this.edgeSlam;
    this.state.action = this.edgeAction;
    this.state.pause = this.edgePause;
    this.state.mute = this.edgeMute;

    // Continuous (Keyboard or Mobile touch state)
    this.state.fly =
      this.keysDown.has('Space') ||
      this.keysDown.has('ArrowUp') ||
      this.keysDown.has('KeyW') ||
      this.touchFlying;

    this.state.boost =
      this.keysDown.has('ShiftLeft') ||
      this.keysDown.has('ShiftRight') ||
      this.touchBoosting;

    // Clear edge triggers
    this.edgeLeft = false;
    this.edgeRight = false;
    this.edgeSlam = false;
    this.edgeAction = false;
    this.edgePause = false;
    this.edgeMute = false;

    return this.state;
  }

  // ── Keyboard ──────────────────────────────────
  private _onKeyDown = (e: KeyboardEvent): void => {
    if (e.repeat) return;
    this.keysDown.add(e.code);

    switch (e.code) {
      case 'ArrowLeft':
      case 'KeyA':
        this.edgeLeft = true;
        break;
      case 'ArrowRight':
      case 'KeyD':
        this.edgeRight = true;
        break;
      case 'ArrowDown':
      case 'KeyS':
        this.edgeSlam = true;
        break;
      case 'Space':
      case 'ArrowUp':
      case 'KeyW':
        this.edgeAction = true;
        e.preventDefault(); // Prevent page scroll
        break;
      case 'KeyP':
      case 'Escape':
        this.edgePause = true;
        break;
      case 'KeyM':
        this.edgeMute = true;
        break;
    }
  };

  private _onKeyUp = (e: KeyboardEvent): void => {
    this.keysDown.delete(e.code);
  };

  // ── Touch / Swipe (Mobile) ────────────────────
  private _onTouchStart = (e: TouchEvent): void => {
    if (e.touches.length === 0) return;

    // Multi-touch (2 fingers down) = BOOST!
    if (e.touches.length >= 2) {
      this.touchBoosting = true;
    }

    const t = e.touches[0]!;
    this.touchStartX = t.clientX;
    this.touchStartY = t.clientY;
    this.touchActive = true;

    // Double-tap & hold anywhere = BOOST!
    const now = performance.now();
    if (now - this.lastTouchTime < 280) {
      this.touchBoosting = true;
    }
    this.lastTouchTime = now;

    // Clear any pending long-press timer
    if (this.longPressTimer !== null) {
      window.clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }

    // Long press: holding finger down for >= 220ms activates boost
    this.longPressTimer = window.setTimeout(() => {
      if (this.touchActive && !this.touchFlying) {
        this.touchBoosting = true;
      }
    }, InputManager.LONG_PRESS_DELAY);

    // Tap = action for menus / play / retry
    this.edgeAction = true;
  };

  private _onTouchMove = (e: TouchEvent): void => {
    if (!this.touchActive || e.touches.length === 0) return;

    const t = e.touches[0]!;
    const dx = t.clientX - this.touchStartX;
    const dy = t.clientY - this.touchStartY;

    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    // Dominant horizontal swipe -> LANE SWITCH ONLY (NO JUMP!)
    // Note: if user is already long-press boosting, allow lane steering while boosting!
    if (absDx > absDy && absDx > InputManager.SWIPE_THRESHOLD) {
      if (dx < 0) {
        this.edgeLeft = true;
      } else {
        this.edgeRight = true;
      }
      this.touchStartX = t.clientX;
      this.touchStartY = t.clientY;
    } 
    // Dominant vertical swipe
    else if (absDy > absDx && absDy > InputManager.SWIPE_THRESHOLD) {
      if (dy < 0) {
        // SWIPE UP -> JUMP & FLY! (Cancel boost timer so vertical jump doesn't conflict)
        this.touchFlying = true;
        this.touchBoosting = false;
        if (this.longPressTimer !== null) {
          window.clearTimeout(this.longPressTimer);
          this.longPressTimer = null;
        }
      } else {
        // SWIPE DOWN -> SLAM DIVE!
        this.edgeSlam = true;
        this.touchFlying = false;
        this.touchBoosting = false;
        if (this.longPressTimer !== null) {
          window.clearTimeout(this.longPressTimer);
          this.longPressTimer = null;
        }
      }
      this.touchStartX = t.clientX;
      this.touchStartY = t.clientY;
    }
  };

  private _onTouchEnd = (e: TouchEvent): void => {
    // Clear long press timer whenever touch ends
    if (this.longPressTimer !== null) {
      window.clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }

    if (e.touches.length === 0) {
      this.touchActive = false;
      this.touchFlying = false;
      this.touchBoosting = false;
    } else if (e.touches.length === 1) {
      // Released secondary finger
      this.touchBoosting = false;
    }
  };

  public dispose(): void {
    if (this.longPressTimer !== null) {
      window.clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    window.removeEventListener('touchstart', this._onTouchStart);
    window.removeEventListener('touchmove', this._onTouchMove);
    window.removeEventListener('touchend', this._onTouchEnd);
    window.removeEventListener('touchcancel', this._onTouchEnd);
  }
}

