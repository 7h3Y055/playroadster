/**
 * AdManager.ts — Monetization manager supporting Google AdSense for H5 Games API (adBreak)
 * and rewarded video / interstitial / banner ad placements with graceful sandbox fallbacks.
 */

declare global {
  interface Window {
    adsbygoogle?: any[];
    adBreak?: (options: any) => void;
    adConfig?: (options: any) => void;
  }
}

export type RewardType = 'revive' | 'double_coins';

export interface AdManagerCallbacks {
  onAdStart?: () => void;
  onAdEnd?: () => void;
}

export class AdManager {
  private gamesPlayed = 0;
  private readonly INTERSTITIAL_FREQUENCY = 3; // Show interstitial every 3 games
  private isAdPlaying = false;
  private callbacks: AdManagerCallbacks;

  // DOM elements for ad simulation / fallback
  private overlayEl: HTMLElement | null = null;
  private timerEl: HTMLElement | null = null;
  private progressFillEl: HTMLElement | null = null;

  constructor(callbacks: AdManagerCallbacks = {}) {
    this.callbacks = callbacks;
    this._initElements();
    this._initGoogleH5();
    this.initBanners();
  }

  private _initElements(): void {
    if (typeof document === 'undefined') return;
    this.overlayEl = document.getElementById('ad-container');
    this.timerEl = document.getElementById('ad-timer');
    this.progressFillEl = document.getElementById('ad-progress-fill');
  }

  /** Initialize Google AdSense for H5 Games API config if available */
  private _initGoogleH5(): void {
    if (typeof window !== 'undefined' && typeof window.adConfig === 'function') {
      try {
        window.adConfig({
          preloadAdBreaks: 'on',
          sound: 'on',
        });
      } catch (err) {
        console.warn('[AdManager] Google adConfig init warning:', err);
      }
    }
  }

  /** Safe push for responsive AdSense banner units */
  public initBanners(): void {
    if (typeof window === 'undefined') return;
    try {
      const ads = document.querySelectorAll<HTMLElement>('.adsbygoogle:not([data-adsbygoogle-status])');
      ads.forEach(() => {
        try {
          (window.adsbygoogle = window.adsbygoogle || []).push({});
        } catch {
          /* ignore banner push errors */
        }
      });
    } catch {
      /* ignore */
    }
  }

  /**
   * Show a rewarded video ad (for Revive Car or 2X Coins).
   * Calls Google H5 Games adBreak('reward') if ready, or plays high-fidelity arcade ad simulation.
   */
  public showRewardedAd(
    type: RewardType,
    onReward: () => void,
    onDismiss?: () => void
  ): Promise<boolean> {
    return new Promise((resolve) => {
      if (this.isAdPlaying) {
        resolve(false);
        return;
      }

      this.isAdPlaying = true;
      this.callbacks.onAdStart?.();

      // Check if official Google H5 Games adBreak is present
      if (typeof window !== 'undefined' && typeof window.adBreak === 'function') {
        let rewardEarned = false;

        try {
          window.adBreak({
            type: 'reward',
            name: type === 'revive' ? 'revive_runner' : 'double_tokens',
            beforeAd: () => {
              this.callbacks.onAdStart?.();
            },
            afterAd: () => {
              this.isAdPlaying = false;
              this.callbacks.onAdEnd?.();
            },
            beforeReward: (showAdFn: () => void) => {
              showAdFn();
            },
            adViewed: () => {
              rewardEarned = true;
              onReward();
            },
            adDismissed: () => {
              onDismiss?.();
            },
            adBreakDone: () => {
              this.isAdPlaying = false;
              this.callbacks.onAdEnd?.();
              resolve(rewardEarned);
            },
          });
          return;
        } catch (e) {
          console.warn('[AdManager] Google adBreak failed, falling back to test ad:', e);
        }
      }

      // Built-in test ad simulation for pending review / sandbox mode
      this._playSimulatedAd(type, () => {
        this.isAdPlaying = false;
        this.callbacks.onAdEnd?.();
        onReward();
        resolve(true);
      });
    });
  }

  /**
   * Check and show an interstitial ad every N game overs
   */
  public recordGameOverAndCheckInterstitial(): Promise<boolean> {
    this.gamesPlayed++;
    if (this.gamesPlayed % this.INTERSTITIAL_FREQUENCY === 0) {
      return this.showInterstitialAd('game_over_break');
    }
    return Promise.resolve(false);
  }

  /**
   * Show an interstitial ad break
   */
  public showInterstitialAd(placementName = 'next_round'): Promise<boolean> {
    return new Promise((resolve) => {
      if (this.isAdPlaying) {
        resolve(false);
        return;
      }

      this.isAdPlaying = true;
      this.callbacks.onAdStart?.();

      if (typeof window !== 'undefined' && typeof window.adBreak === 'function') {
        try {
          window.adBreak({
            type: 'next',
            name: placementName,
            beforeAd: () => {
              this.callbacks.onAdStart?.();
            },
            afterAd: () => {
              this.isAdPlaying = false;
              this.callbacks.onAdEnd?.();
            },
            adBreakDone: () => {
              this.isAdPlaying = false;
              this.callbacks.onAdEnd?.();
              resolve(true);
            },
          });
          return;
        } catch {
          /* fallback */
        }
      }

      // Fast 3s simulated interstitial for sandbox testing
      this._playSimulatedInterstitial(() => {
        this.isAdPlaying = false;
        this.callbacks.onAdEnd?.();
        resolve(true);
      });
    });
  }

  /** Simulated Rewarded Ad with 5s countdown */
  private _playSimulatedAd(type: RewardType, onComplete: () => void): void {
    if (!this.overlayEl) {
      this._initElements();
    }
    if (!this.overlayEl) {
      setTimeout(onComplete, 1000);
      return;
    }

    this.overlayEl.classList.remove('hidden');

    const totalSeconds = 5;
    let secondsLeft = totalSeconds;

    const rewardName = type === 'revive' ? 'Revive Car' : 'Double Tokens';
    if (this.timerEl) {
      this.timerEl.textContent = `${rewardName} in ${secondsLeft}s`;
    }
    if (this.progressFillEl) {
      this.progressFillEl.style.width = '0%';
    }

    const interval = setInterval(() => {
      secondsLeft--;
      const pct = ((totalSeconds - secondsLeft) / totalSeconds) * 100;

      if (this.progressFillEl) {
        this.progressFillEl.style.width = `${pct}%`;
      }

      if (secondsLeft <= 0) {
        clearInterval(interval);
        if (this.timerEl) {
          this.timerEl.textContent = 'Reward Granted! ✓';
        }
        setTimeout(() => {
          this.overlayEl?.classList.add('hidden');
          onComplete();
        }, 500);
      } else if (this.timerEl) {
        this.timerEl.textContent = `Reward in ${secondsLeft}s`;
      }
    }, 1000);
  }

  /** Simulated Interstitial with 2.5s display */
  private _playSimulatedInterstitial(onComplete: () => void): void {
    if (!this.overlayEl) {
      setTimeout(onComplete, 1000);
      return;
    }

    this.overlayEl.classList.remove('hidden');
    if (this.timerEl) {
      this.timerEl.textContent = 'Ad · Resuming in 2s';
    }

    setTimeout(() => {
      this.overlayEl?.classList.add('hidden');
      onComplete();
    }, 2200);
  }
}
