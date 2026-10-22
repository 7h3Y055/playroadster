/**
 * GameLoop.ts — Fixed timestep accumulator loop.
 * Physics runs at a fixed 1/60s tick; rendering interpolates with RAF.
 */

export interface Updatable {
  /** Fixed-step physics/logic update (dt is always FIXED_DT) */
  update(dt: number): void;
}

export type RenderCallback = (alpha: number) => void;

const FIXED_DT = 1 / 60; // 60 Hz physics tick
const MAX_FRAME_TIME = 0.1; // Clamp to avoid spiral-of-death on tab-switch

export class GameLoop {
  private accumulator = 0;
  private running = false;
  private animationFrameId = 0;
  private lastTime = 0;

  private readonly updatables: Updatable[] = [];
  private readonly renderCallbacks: RenderCallback[] = [];

  /** Register an object whose update() will be called each fixed tick */
  public addUpdatable(u: Updatable): void {
    this.updatables.push(u);
  }

  /** Register a render callback (called once per frame with interpolation alpha) */
  public addRenderCallback(cb: RenderCallback): void {
    this.renderCallbacks.push(cb);
  }

  public start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now() / 1000;
    this.accumulator = 0;
    this.animationFrameId = requestAnimationFrame(this._tick);
  }

  public stop(): void {
    this.running = false;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = 0;
    }
  }

  public get isRunning(): boolean {
    return this.running;
  }

  /** The fixed timestep used for physics (exposed for external use) */
  public get fixedDt(): number {
    return FIXED_DT;
  }

  private _tick = (nowMs: number): void => {
    if (!this.running) return;

    const now = nowMs / 1000;
    let frameTime = now - this.lastTime;
    this.lastTime = now;

    // Clamp frame time to prevent accumulator explosion
    if (frameTime > MAX_FRAME_TIME) frameTime = MAX_FRAME_TIME;

    this.accumulator += frameTime;

    // Run fixed-step physics updates
    while (this.accumulator >= FIXED_DT) {
      for (const u of this.updatables) {
        u.update(FIXED_DT);
      }
      this.accumulator -= FIXED_DT;
    }

    // Interpolation alpha for smooth rendering between physics ticks
    const alpha = this.accumulator / FIXED_DT;

    // Render
    for (const cb of this.renderCallbacks) {
      cb(alpha);
    }

    this.animationFrameId = requestAnimationFrame(this._tick);
  };
}
