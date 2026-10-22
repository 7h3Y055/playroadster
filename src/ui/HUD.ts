/**
 * HUD.ts — Updates HTML DOM elements for air bar, score, combo, popups, etc.
 * All styling uses CSS classes from globals.css — no inline colors.
 */

export class HUD {
  // ── Element refs (cached on construction) ──
  private readonly els: {
    hud: HTMLElement;
    score: HTMLElement;
    dist: HTMLElement;
    airFill: HTMLElement;
    airBar: HTMLElement;
    airVal: HTMLElement;
    combo: HTMLElement;
    comboMult: HTMLElement;
    comboCount: HTMLElement;
    comboFill: HTMLElement;
    comboTotal: HTMLElement;
    feverFill: HTMLElement;
    fever: HTMLElement;
    popups: HTMLElement;
    centerText: HTMLElement;
    flash: HTMLElement;
    startGuide: HTMLElement;
    coinCount: HTMLElement;
    coinBox: HTMLElement;
  };

  constructor() {
    this.els = {
      hud: document.getElementById('hud')!,
      score: document.getElementById('score')!,
      dist: document.getElementById('dist')!,
      airFill: document.getElementById('air-fill')!,
      airBar: document.querySelector('.air-bar')! as HTMLElement,
      airVal: document.getElementById('air-val')!,
      combo: document.getElementById('combo')!,
      comboMult: document.getElementById('combo-mult')!,
      comboCount: document.getElementById('combo-count')!,
      comboFill: document.getElementById('combo-fill')!,
      comboTotal: document.getElementById('combo-total')!,
      feverFill: document.getElementById('fever-fill')!,
      fever: document.getElementById('fever')!,
      popups: document.getElementById('popups')!,
      centerText: document.getElementById('center-text')!,
      flash: document.getElementById('flash')!,
      startGuide: document.getElementById('start-guide')!,
      coinCount: document.getElementById('coin-count')!,
      coinBox: document.getElementById('hud-coins')!,
    };
  }

  public show(): void {
    this.els.hud.classList.remove('hidden');
  }

  public hide(): void {
    this.els.hud.classList.add('hidden');
  }

  // ── Score ──────────────────────────────
  public setScore(score: number): void {
    this.els.score.textContent = String(score);
  }

  public setDistance(meters: number): void {
    this.els.dist.textContent = String(Math.floor(meters));
  }

  // ── Coin / Token Counter ────────────────
  public setCoins(count: number, animate = false): void {
    if (this.els.coinCount) {
      this.els.coinCount.textContent = String(count);
    }
    if (animate && this.els.coinBox) {
      this.els.coinBox.classList.remove('coin-pop');
      void this.els.coinBox.offsetWidth; // Trigger reflow
      this.els.coinBox.classList.add('coin-pop');
      setTimeout(() => {
        this.els.coinBox.classList.remove('coin-pop');
      }, 250);
    }
  }

  // ── Air Gauge (600 L Compressed Air Tank) ─────
  public setAir(liters: number, maxLiters = 600): void {
    const ratio = Math.max(0, Math.min(1, liters / maxLiters));
    this.els.airFill.style.transform = `scaleX(${ratio.toFixed(3)})`;
    this.els.airVal.textContent = `${Math.round(liters)} L`;

    // Low Air Warning (< 20% = 120 L from Roadster Dash lowRatio)
    this.els.airBar.classList.remove('mid', 'low');
    if (ratio < 0.2) {
      this.els.airBar.classList.add('low');
    } else if (ratio < 0.5) {
      this.els.airBar.classList.add('mid');
    }
  }

  /** Warning flash on air bar when player attempts an air action with insufficient air */
  public flashNoAir(): void {
    this.els.airBar.classList.add('no-air-pulse');
    setTimeout(() => {
      this.els.airBar.classList.remove('no-air-pulse');
    }, 250);
  }

  // ── Combo / Streak ────────────────────
  public showCombo(multiplier: number, count: number): void {
    this.els.combo.classList.add('active');
    this.els.comboMult.textContent = `×${multiplier}`;
    this.els.comboCount.textContent = `STREAK ${count} ACTIVE`;
  }

  public updateComboTimer(remaining: number): void {
    this.els.comboFill.style.transform = `scaleX(${remaining.toFixed(3)})`;
  }

  public hideCombo(totalBonus: number): void {
    if (totalBonus > 0) {
      this.els.comboTotal.textContent = `+${totalBonus}`;
      this.els.comboTotal.style.opacity = '1';
      setTimeout(() => {
        this.els.comboTotal.style.opacity = '0';
      }, 1500);
    }
    setTimeout(() => {
      this.els.combo.classList.remove('active');
    }, 300);
  }

  // ── Fever / Rocket Meter ──────────────
  public setFever(percent: number): void {
    this.els.feverFill.style.transform = `scaleX(${(percent / 100).toFixed(3)})`;
  }

  public setFeverReady(ready: boolean): void {
    this.els.fever.classList.toggle('ready', ready);
  }

  // ── Award Popups ──────────────────────
  public showPopup(text: string): void {
    const el = document.createElement('div');
    el.className = 'popup';
    el.textContent = text;
    this.els.popups.appendChild(el);

    // Remove after animation
    setTimeout(() => {
      el.remove();
    }, 1200);
  }

  // ── Center Text (3-2-1-GO) ────────────
  public showCenterText(text: string): void {
    this.els.centerText.textContent = text;
    this.els.centerText.classList.remove('show');
    // Force reflow to restart animation
    void this.els.centerText.offsetWidth;
    this.els.centerText.classList.add('show');
  }

  public hideCenterText(): void {
    this.els.centerText.classList.remove('show');
    this.els.centerText.textContent = '';
  }

  // ── Flash Effect ──────────────────────
  public flash(duration: number = 150): void {
    this.els.flash.style.opacity = '0.3';
    setTimeout(() => {
      this.els.flash.style.opacity = '0';
    }, duration);
  }

  // ── Start Guide ───────────────────────
  public showStartGuide(): void {
    this.els.startGuide.classList.add('visible');
  }

  public hideStartGuide(): void {
    this.els.startGuide.classList.remove('visible');
  }

  // ── Game Over Screen ──────────────────
  public showGameOver(
    score: number,
    distance: number,
    time: string,
    isRecord: boolean,
    coins = 0,
    careerCoins = 0
  ): void {
    const goScreen = document.getElementById('gameover')!;
    document.getElementById('go-score')!.textContent = String(score);
    document.getElementById('go-dist')!.textContent = `${Math.floor(distance)} m`;
    document.getElementById('go-time')!.textContent = time;

    const goCoinsEl = document.getElementById('go-coins');
    if (goCoinsEl) goCoinsEl.textContent = String(coins);

    const goCareerCoinsEl = document.getElementById('go-career-coins');
    if (goCareerCoinsEl) goCareerCoinsEl.textContent = String(careerCoins);

    const recordEl = document.getElementById('go-record')!;
    if (isRecord) {
      recordEl.classList.remove('hidden');
    } else {
      recordEl.classList.add('hidden');
    }

    goScreen.classList.remove('hidden');
  }

  public hideGameOver(): void {
    document.getElementById('gameover')!.classList.add('hidden');
  }

  // ── Menu Screen ───────────────────────
  public showMenu(): void {
    document.getElementById('menu')!.classList.remove('hidden');
  }

  public hideMenu(): void {
    document.getElementById('menu')!.classList.add('hidden');
  }

  public setBestScores(score: number, distance: number, careerCoins = 0): void {
    document.getElementById('best-score')!.textContent = score > 0 ? String(score) : '—';
    document.getElementById('best-dist')!.textContent = distance > 0 ? `${distance} m` : '—';

    const menuCoinsEl = document.getElementById('menu-total-coins');
    if (menuCoinsEl) {
      menuCoinsEl.textContent = String(careerCoins);
    }
  }

  // ── Loading Screen ────────────────────
  public setLoadingProgress(percent: number): void {
    const fill = document.getElementById('loading-fill')!;
    const pct = document.getElementById('loading-pct')!;
    fill.style.transform = `scaleX(${(percent / 100).toFixed(3)})`;
    pct.textContent = `${Math.round(percent)}%`;
  }

  public hideLoading(): void {
    const loading = document.getElementById('loading')!;
    loading.classList.add('done');
    setTimeout(() => {
      loading.style.display = 'none';
    }, 400);
  }
}
