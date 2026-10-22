/**
 * ScoreManager.ts — Scoring, combos, streaks, near-miss detection, fever meter.
 */

export interface ScoreEvents {
  onScoreChange?: (score: number) => void;
  onComboStart?: (multiplier: number) => void;
  onComboEnd?: (totalBonus: number) => void;
  onComboTick?: (multiplier: number, remaining: number) => void;
  onNearMiss?: (bonus: number) => void;
  onTrick?: (name: string, bonus: number) => void;
  onCoinCollected?: (coins: number, bonus: number) => void;
  onFeverReady?: () => void;
  onFeverActivate?: () => void;
  onFeverEnd?: () => void;
}

const COMBO_WINDOW = 3.0;       // Seconds to chain near-misses
const NEAR_MISS_BONUS = 50;
const FLIP_BONUS = 120;
const MAX_MULTIPLIER = 6;
const FEVER_THRESHOLD = 100;    // Points to fill fever meter
const FEVER_DURATION = 5.0;     // Seconds of invincibility

export class ScoreManager {
  public score = 0;
  public distance = 0;
  public coins = 0;
  public bestCoins = 0;
  public careerCoins = 0;
  public comboMultiplier = 1;
  public comboTimer = 0;
  public comboCount = 0;
  public comboTotalBonus = 0;
  public feverMeter = 0;        // 0–100
  public feverActive = false;
  public feverTimer = 0;
  public bestScore = 0;
  public bestDistance = 0;
  public elapsedTime = 0;

  private events: ScoreEvents;

  constructor(events: ScoreEvents = {}) {
    this.events = events;
    this._loadBest();
  }

  /** Called each fixed tick with distance traveled this tick */
  public addDistance(delta: number): void {
    this.distance += delta;
    this.score += Math.floor(delta);
    this.events.onScoreChange?.(this.score);
  }

  /** Called when player passes within near-miss margin */
  public registerNearMiss(): void {
    const bonus = NEAR_MISS_BONUS * this.comboMultiplier;
    this.score += bonus;
    this.comboCount++;
    this._extendCombo();
    this._addFever(10);
    this.events.onNearMiss?.(bonus);
    this.events.onScoreChange?.(this.score);
  }

  /** Called when player completes a trick (front flip) */
  public registerTrick(name: string): void {
    const bonus = FLIP_BONUS * this.comboMultiplier;
    this.score += bonus;
    this.comboCount++;
    this._extendCombo();
    this._addFever(15);
    this.events.onTrick?.(name, bonus);
    this.events.onScoreChange?.(this.score);
  }

  /** Called when player collects a gold coin / token */
  public addCoin(amount = 1): number {
    this.coins += amount;
    this.careerCoins += amount;
    const bonus = 25 * this.comboMultiplier;
    this.score += bonus;
    this._addFever(3);
    this.events.onCoinCollected?.(this.coins, bonus);
    this.events.onScoreChange?.(this.score);
    return bonus;
  }

  /** Update combo timer */
  public updateCombo(dt: number): void {
    this.elapsedTime += dt;

    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      this.events.onComboTick?.(this.comboMultiplier, this.comboTimer / COMBO_WINDOW);

      if (this.comboTimer <= 0) {
        // Combo expired
        this.events.onComboEnd?.(this.comboTotalBonus);
        this.comboMultiplier = 1;
        this.comboCount = 0;
        this.comboTotalBonus = 0;
        this.comboTimer = 0;
      }
    }

    // Fever timer
    if (this.feverActive) {
      this.feverTimer -= dt;
      if (this.feverTimer <= 0) {
        this.feverActive = false;
        this.feverTimer = 0;
        this.feverMeter = 0;
        this.events.onFeverEnd?.();
      }
    }
  }

  private _extendCombo(): void {
    const wasInactive = this.comboTimer <= 0;
    this.comboTimer = COMBO_WINDOW;
    if (this.comboCount > 1 && this.comboMultiplier < MAX_MULTIPLIER) {
      this.comboMultiplier = Math.min(MAX_MULTIPLIER, 1 + Math.floor(this.comboCount / 2));
    }
    this.comboTotalBonus += NEAR_MISS_BONUS * this.comboMultiplier;
    if (wasInactive) {
      this.events.onComboStart?.(this.comboMultiplier);
    }
  }

  private _addFever(amount: number): void {
    if (this.feverActive) return;
    this.feverMeter = Math.min(FEVER_THRESHOLD, this.feverMeter + amount);
    if (this.feverMeter >= FEVER_THRESHOLD) {
      this.events.onFeverReady?.();
    }
  }

  /** Activate fever mode (invincibility + speed boost) */
  public activateFever(): void {
    if (this.feverMeter < FEVER_THRESHOLD || this.feverActive) return;
    this.feverActive = true;
    this.feverTimer = FEVER_DURATION;
    this.events.onFeverActivate?.();
  }

  /** Format elapsed time as m:ss */
  public getTimeString(): string {
    const mins = Math.floor(this.elapsedTime / 60);
    const secs = Math.floor(this.elapsedTime % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  /** Save best scores, return whether it's a new record */
  public saveBest(): boolean {
    const isRecord = this.score > this.bestScore;
    if (this.score > this.bestScore) this.bestScore = this.score;
    if (this.distance > this.bestDistance) this.bestDistance = this.distance;
    if (this.coins > this.bestCoins) this.bestCoins = this.coins;
    try {
      localStorage.setItem('roadster_best_score', String(this.bestScore));
      localStorage.setItem('roadster_best_dist', String(Math.floor(this.bestDistance)));
      localStorage.setItem('roadster_best_coins', String(this.bestCoins));
      localStorage.setItem('roadster_career_coins', String(this.careerCoins));
    } catch { /* localStorage unavailable */ }
    return isRecord;
  }

  private _loadBest(): void {
    try {
      this.bestScore = parseInt(localStorage.getItem('roadster_best_score') || '0', 10);
      this.bestDistance = parseInt(localStorage.getItem('roadster_best_dist') || '0', 10);
      this.bestCoins = parseInt(localStorage.getItem('roadster_best_coins') || '0', 10);
      this.careerCoins = parseInt(localStorage.getItem('roadster_career_coins') || '0', 10);
    } catch { /* localStorage unavailable */ }
  }

  public resetScores(): void {
    this.bestScore = 0;
    this.bestDistance = 0;
    this.bestCoins = 0;
    this.careerCoins = 0;
    try {
      localStorage.removeItem('roadster_best_score');
      localStorage.removeItem('roadster_best_dist');
      localStorage.removeItem('roadster_best_coins');
      localStorage.removeItem('roadster_career_coins');
    } catch { /* ignore */ }
  }

  public reset(): void {
    this.score = 0;
    this.distance = 0;
    this.coins = 0;
    this.comboMultiplier = 1;
    this.comboTimer = 0;
    this.comboCount = 0;
    this.comboTotalBonus = 0;
    this.feverMeter = 0;
    this.feverActive = false;
    this.feverTimer = 0;
    this.elapsedTime = 0;
  }
}
