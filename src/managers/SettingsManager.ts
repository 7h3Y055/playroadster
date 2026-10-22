/**
 * SettingsManager.ts — Complete user preferences and settings system.
 * Controls master/music/sfx volume sliders, mute toggles, graphics presets,
 * bloom/speedlines toggles, and data reset. Persists seamlessly in localStorage.
 */
import { AudioManager } from '@managers/AudioManager';
import { GraphicsManager, type GraphicsMode } from '@managers/GraphicsManager';
import { ScoreManager } from '@managers/ScoreManager';

export interface GameSettings {
  masterVolume: number; // 0 - 100
  musicVolume: number;  // 0 - 100
  sfxVolume: number;    // 0 - 100
  muted: boolean;
  graphicsMode: GraphicsMode;
  bloomEnabled: boolean;
  speedLinesEnabled: boolean;
}

const DEFAULT_SETTINGS: GameSettings = {
  masterVolume: 85,
  musicVolume: 35,
  sfxVolume: 70,
  muted: false,
  graphicsMode: 'high',
  bloomEnabled: true,
  speedLinesEnabled: true,
};

const STORAGE_KEY = 'roadster_user_settings';

export class SettingsManager {
  public settings: GameSettings;
  private readonly audio: AudioManager;
  private readonly graphics: GraphicsManager;
  private readonly score: ScoreManager;

  public isOpen = false;
  public onOpen?: () => void;
  public onClose?: () => void;
  public onResetData?: () => void;

  private modalEl: HTMLElement | null = null;

  constructor(audio: AudioManager, graphics: GraphicsManager, score: ScoreManager) {
    this.audio = audio;
    this.graphics = graphics;
    this.score = score;
    this.settings = this._loadSettings();

    // Bind DOM when available
    setTimeout(() => {
      this._initDOM();
      this.applyAll();
    }, 0);
  }

  private _loadSettings(): GameSettings {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
      }
    } catch { /* ignore */ }
    return { ...DEFAULT_SETTINGS };
  }

  public save(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
    } catch { /* ignore */ }
  }

  private _initDOM(): void {
    this.modalEl = document.getElementById('settings-modal');
    if (!this.modalEl) return;

    // Close button
    const closeBtn = document.getElementById('settings-close-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.close());
    }

    // Backdrop click to close
    this.modalEl.addEventListener('click', (e) => {
      if (e.target === this.modalEl) {
        this.close();
      }
    });

    // ── Sliders ───────────────────────────
    const masterSlider = document.getElementById('setting-master-vol') as HTMLInputElement | null;
    const masterVal = document.getElementById('setting-master-val');
    if (masterSlider) {
      masterSlider.value = String(this.settings.masterVolume);
      if (masterVal) masterVal.textContent = `${this.settings.masterVolume}%`;
      masterSlider.addEventListener('input', () => {
        this.settings.masterVolume = parseInt(masterSlider.value, 10);
        if (masterVal) masterVal.textContent = `${this.settings.masterVolume}%`;
        this.audio.setMasterVolume(this.settings.masterVolume / 100);
        this.save();
      });
    }

    const musicSlider = document.getElementById('setting-music-vol') as HTMLInputElement | null;
    const musicVal = document.getElementById('setting-music-val');
    if (musicSlider) {
      musicSlider.value = String(this.settings.musicVolume);
      if (musicVal) musicVal.textContent = `${this.settings.musicVolume}%`;
      musicSlider.addEventListener('input', () => {
        this.settings.musicVolume = parseInt(musicSlider.value, 10);
        if (musicVal) musicVal.textContent = `${this.settings.musicVolume}%`;
        this.audio.setMusicVolume(this.settings.musicVolume / 100);
        this.save();
      });
    }

    const sfxSlider = document.getElementById('setting-sfx-vol') as HTMLInputElement | null;
    const sfxVal = document.getElementById('setting-sfx-val');
    if (sfxSlider) {
      sfxSlider.value = String(this.settings.sfxVolume);
      if (sfxVal) sfxVal.textContent = `${this.settings.sfxVolume}%`;
      sfxSlider.addEventListener('input', () => {
        this.settings.sfxVolume = parseInt(sfxSlider.value, 10);
        if (sfxVal) sfxVal.textContent = `${this.settings.sfxVolume}%`;
        this.audio.setSfxVolume(this.settings.sfxVolume / 100);
        this.save();
      });
    }

    // ── Mute Toggle ───────────────────────
    const muteToggle = document.getElementById('setting-mute-toggle') as HTMLInputElement | null;
    if (muteToggle) {
      muteToggle.checked = this.settings.muted;
      muteToggle.addEventListener('change', () => {
        this.settings.muted = muteToggle.checked;
        if (this.audio.isMuted !== this.settings.muted) {
          this.audio.toggleMute();
        }
        this.save();
      });
    }

    // ── Graphics Quality Tabs in Modal ────
    const modalGfxTabs = document.querySelectorAll('#modal-graphics-tabs .graphics-tab');
    modalGfxTabs.forEach((tab) => {
      tab.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        const mode = target.dataset.mode as GraphicsMode;
        if (mode) {
          this.setGraphicsMode(mode);
        }
      });
    });

    // ── Feature Toggles ───────────────────
    const bloomToggle = document.getElementById('setting-bloom-toggle') as HTMLInputElement | null;
    if (bloomToggle) {
      bloomToggle.checked = this.settings.bloomEnabled;
      bloomToggle.addEventListener('change', () => {
        this.settings.bloomEnabled = bloomToggle.checked;
        this.save();
      });
    }

    const linesToggle = document.getElementById('setting-speedlines-toggle') as HTMLInputElement | null;
    if (linesToggle) {
      linesToggle.checked = this.settings.speedLinesEnabled;
      linesToggle.addEventListener('change', () => {
        this.settings.speedLinesEnabled = linesToggle.checked;
        this.save();
      });
    }

    // ── Reset High Scores Button ──────────
    const resetBtn = document.getElementById('setting-reset-scores-btn');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        if (confirm('Reset best score, distance, and career tokens to 0?')) {
          this.score.resetScores();
          this.onResetData?.();
          alert('High scores and career tokens have been reset.');
        }
      });
    }
  }

  public setGraphicsMode(mode: GraphicsMode): void {
    this.settings.graphicsMode = mode;
    this.graphics.setMode(mode);
    this.save();

    // Update active tab styling in modal
    const tabs = document.querySelectorAll('#modal-graphics-tabs .graphics-tab');
    tabs.forEach((t) => {
      const m = (t as HTMLElement).dataset.mode;
      const isActive = m === mode;
      t.classList.toggle('active', isActive);
      t.setAttribute('aria-checked', String(isActive));
    });

    const descEl = document.getElementById('graphics-modal-desc');
    if (descEl) {
      const preset = GraphicsManager.PRESETS[mode];
      descEl.textContent = preset ? preset.description : '';
    }
  }

  public applyAll(): void {
    this.audio.setMasterVolume(this.settings.masterVolume / 100);
    this.audio.setMusicVolume(this.settings.musicVolume / 100);
    this.audio.setSfxVolume(this.settings.sfxVolume / 100);

    if (this.audio.isMuted !== this.settings.muted) {
      this.audio.toggleMute();
    }

    this.graphics.setMode(this.settings.graphicsMode);
  }

  public open(): void {
    if (!this.modalEl) this.modalEl = document.getElementById('settings-modal');
    if (!this.modalEl) return;

    this.isOpen = true;
    this.modalEl.classList.add('visible');
    this.modalEl.setAttribute('aria-hidden', 'false');

    // Sync UI with current settings
    this._syncUI();

    this.onOpen?.();
  }

  public close(): void {
    if (!this.modalEl) return;
    this.isOpen = false;
    this.modalEl.classList.remove('visible');
    this.modalEl.setAttribute('aria-hidden', 'true');
    this.save();

    this.onClose?.();
  }

  public toggle(): void {
    if (this.isOpen) this.close();
    else this.open();
  }

  private _syncUI(): void {
    const masterSlider = document.getElementById('setting-master-vol') as HTMLInputElement | null;
    const masterVal = document.getElementById('setting-master-val');
    if (masterSlider) masterSlider.value = String(this.settings.masterVolume);
    if (masterVal) masterVal.textContent = `${this.settings.masterVolume}%`;

    const musicSlider = document.getElementById('setting-music-vol') as HTMLInputElement | null;
    const musicVal = document.getElementById('setting-music-val');
    if (musicSlider) musicSlider.value = String(this.settings.musicVolume);
    if (musicVal) musicVal.textContent = `${this.settings.musicVolume}%`;

    const sfxSlider = document.getElementById('setting-sfx-vol') as HTMLInputElement | null;
    const sfxVal = document.getElementById('setting-sfx-val');
    if (sfxSlider) sfxSlider.value = String(this.settings.sfxVolume);
    if (sfxVal) sfxVal.textContent = `${this.settings.sfxVolume}%`;

    const muteToggle = document.getElementById('setting-mute-toggle') as HTMLInputElement | null;
    if (muteToggle) muteToggle.checked = this.settings.muted;

    const tabs = document.querySelectorAll('#modal-graphics-tabs .graphics-tab');
    tabs.forEach((t) => {
      const m = (t as HTMLElement).dataset.mode;
      const isActive = m === this.settings.graphicsMode;
      t.classList.toggle('active', isActive);
      t.setAttribute('aria-checked', String(isActive));
    });
  }
}
