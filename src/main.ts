import * as THREE from 'three';
import './globals.css';
import { Engine } from '@core/Engine';
import { GameLoop } from '@core/GameLoop';
import { InputManager } from '@core/InputManager';
import { Player } from '@entities/Player';
import { PoolManager } from '@managers/PoolManager';
import { SpawnManager } from '@managers/SpawnManager';
import { ScoreManager } from '@managers/ScoreManager';
import { AudioManager } from '@managers/AudioManager';
import { PostProcess } from '@vfx/PostProcess';
import { SpeedLinesVFX } from '@vfx/SpeedLinesVFX';
import { HUD } from '@ui/HUD';
import { TrafficModelLoader } from '@utils/TrafficModelLoader';
import { GraphicsManager, type GraphicsMode } from '@managers/GraphicsManager';
import { CoinManager } from '@managers/CoinManager';
import { SettingsManager } from '@managers/SettingsManager';

type GameState = 'LOADING' | 'MENU' | 'COUNTDOWN' | 'PLAYING' | 'PAUSED' | 'GAME_OVER';

class RoadsterDashGame {
  private state: GameState = 'LOADING';

  // ── Subsystems ──────────────────────────
  private readonly engine: Engine;
  private readonly loop: GameLoop;
  private readonly input: InputManager;
  private readonly player: Player;
  private readonly pool: PoolManager;
  private readonly spawn: SpawnManager;
  private readonly coins: CoinManager;
  private readonly score: ScoreManager;
  private readonly audio: AudioManager;
  private readonly postProcess: PostProcess;
  private readonly speedLines: SpeedLinesVFX;
  private readonly hud: HUD;
  private readonly graphics: GraphicsManager;
  private readonly settings: SettingsManager;

  // ── Camera tracking ─────────────────────
  private currentFov = 34;
  private targetFov = 34;
  private camX = 0;
  private camY = 4.1;
  private readonly curCamPos = new THREE.Vector3(4.4, 1.8, 8.2);
  private readonly curCamLookAt = new THREE.Vector3(0, 0.55, -0.8);

  // ── Countdown state ─────────────────────
  private countdownTimer = 0;
  private countdownStep = 3;

  constructor() {
    this.engine = new Engine();
    this.loop = new GameLoop();
    this.input = new InputManager();

    this.player = new Player(this.engine.scene);
    this.pool = new PoolManager(this.engine.scene);
    this.coins = new CoinManager(this.engine.scene, this.pool);

    // Connect horn audio callback to all traffic vehicles
    for (const car of this.pool.trafficPool) {
      car.onHorn = (pan) => this.audio.playHorn(pan);
    }

    this.spawn = new SpawnManager(this.pool);
    this.audio = new AudioManager();
    this.speedLines = new SpeedLinesVFX(this.engine.scene);
    this.hud = new HUD();
    this.postProcess = new PostProcess(this.engine.renderer, this.engine.scene, this.engine.camera);
    this.graphics = new GraphicsManager(this.engine, this.postProcess, this.speedLines);

    this.score = new ScoreManager({
      onScoreChange: (score) => this.hud.setScore(score),
      onNearMiss: (bonus) => {
        this.hud.showPopup(`NEAR MISS +${bonus}`);
        this.hud.flash(80);
      },
      onTrick: (name, bonus) => {
        this.hud.showPopup(`${name.toUpperCase()} +${bonus}`);
        this.audio.playStreakChime(this.score.comboMultiplier);
      },
      onCoinCollected: (coins) => {
        this.hud.setCoins(coins, true);
      },
      onComboStart: (mult) => {
        this.hud.showCombo(mult, this.score.comboCount);
        this.audio.playStreakChime(mult);
      },
      onComboTick: (mult, rem) => {
        this.hud.showCombo(mult, this.score.comboCount);
        this.hud.updateComboTimer(rem);
      },
      onComboEnd: (total) => this.hud.hideCombo(total),
      onFeverReady: () => this.hud.setFeverReady(true),
      onFeverActivate: () => {
        this.hud.flash(200);
        this.hud.showCenterText('ROCKET MODE!');
        setTimeout(() => this.hud.hideCenterText(), 1200);
      },
      onFeverEnd: () => this.hud.setFeverReady(false),
    });

    // ── Coin Collection Wiring ──────────────
    this.coins.onCoinCollected = () => {
      this.score.addCoin(1);
      this.audio.playCoin();
      this.hud.setCoins(this.score.coins, true);
    };

    // ── Settings System Wiring ──────────────
    this.settings = new SettingsManager(this.audio, this.graphics, this.score);
    this.settings.onOpen = () => {
      if (this.state === 'PLAYING') {
        this._togglePause();
      }
    };
    this.settings.onResetData = () => {
      this._updateMenuStats();
    };

    // ── Player Thruster & Stunt Events Wiring ──
    this.player.events = {
      onPuff: () => {
        this.audio.puff(1.0);
      },
      onJump: () => {
        this.audio.jump();
      },
      onBoost: () => {
        this.audio.boost();
      },
      onSlam: () => {
        this.audio.slam();
      },
      onLand: (speed) => {
        this.audio.land(Math.min(1.5, speed / 12));
        if (speed > 10) {
          this.hud.flash(80);
        }
      },
      onTrick: (name, bonus) => {
        this.hud.showPopup(`${name.toUpperCase()} +${bonus}`);
        this.audio.playStreakChime(this.score.comboMultiplier);
      },
      onNoAir: () => {
        this.hud.flashNoAir();
      },
    };

    this._bindDOMEvents();
    this._registerLoopCallbacks();
    this._runLoadingSequence();
  }

  // ── DOM Event Listeners ─────────────────
  private _bindDOMEvents(): void {
    const playBtn = document.getElementById('play-btn');
    if (playBtn) {
      playBtn.addEventListener('click', () => {
        this.audio.playClick();
        this._startCountdown();
      });
    }

    const retryBtn = document.getElementById('retry-btn');
    if (retryBtn) {
      retryBtn.addEventListener('click', () => {
        this.audio.playClick();
        this._startCountdown();
      });
    }

    const goMenuBtn = document.getElementById('go-menu-btn');
    if (goMenuBtn) {
      goMenuBtn.addEventListener('click', () => {
        this.audio.playClick();
        this._showMenu();
      });
    }

    const pauseBtn = document.getElementById('pause-btn');
    if (pauseBtn) {
      pauseBtn.addEventListener('click', () => this._togglePause());
    }

    const muteBtn = document.getElementById('mute-btn');
    if (muteBtn) {
      muteBtn.addEventListener('click', () => this._toggleMute());
    }

    const helpBtn = document.getElementById('help-btn');
    if (helpBtn) {
      helpBtn.addEventListener('click', () => {
        this.audio.playClick();
        this.hud.showStartGuide();
        setTimeout(() => this.hud.hideStartGuide(), 3500);
      });
    }

    // ── Settings Button Listeners ───────────
    const settingsBtn = document.getElementById('settings-btn');
    if (settingsBtn) {
      settingsBtn.addEventListener('click', () => {
        this.audio.playClick();
        this.settings.open();
      });
    }

    const hudSettingsBtn = document.getElementById('hud-settings-btn');
    if (hudSettingsBtn) {
      hudSettingsBtn.addEventListener('click', () => {
        this.audio.playClick();
        this.settings.toggle();
      });
    }

    const goSettingsBtn = document.getElementById('go-settings-btn');
    if (goSettingsBtn) {
      goSettingsBtn.addEventListener('click', () => {
        this.audio.playClick();
        this.settings.open();
      });
    }

    // ── 4 Graphics Modes (Low / Mid / High / Ultra) Wiring ──
    const updateGraphicsUI = (mode: GraphicsMode) => {
      const preset = GraphicsManager.PRESETS[mode];
      const tag = document.getElementById('graphics-active-tag');
      if (tag) tag.textContent = preset.name.toUpperCase();

      const modalDesc = document.getElementById('graphics-modal-desc');
      if (modalDesc) modalDesc.textContent = preset.description;

      document.querySelectorAll('.graphics-tab').forEach((tab) => {
        const btn = tab as HTMLElement;
        const btnMode = btn.dataset.mode;
        const isActive = btnMode === mode;
        btn.classList.toggle('active', isActive);
        btn.setAttribute('aria-checked', String(isActive));
      });
    };

    // Register listener for mode updates
    this.graphics.addListener((mode, preset) => {
      updateGraphicsUI(mode);
      this.hud.showPopup(`GRAPHICS: ${preset.name.toUpperCase()}`);
    });

    // Initialize UI to active mode
    updateGraphicsUI(this.graphics.getMode());

    // Bind tab buttons (in menu and settings modal)
    document.querySelectorAll('.graphics-tab').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        const mode = target.dataset.mode as GraphicsMode;
        if (!mode) return;
        this.audio.playClick();
        this.settings.setGraphicsMode(mode);
      });
    });

    // Hotkey G: Cycle graphics, O / Escape: Settings modal
    window.addEventListener('keydown', (e) => {
      if ((e.key === 'g' || e.key === 'G') && this.state !== 'LOADING') {
        this.graphics.cycle();
        this.audio.playClick();
      } else if ((e.key === 'o' || e.key === 'O') && this.state !== 'LOADING') {
        this.settings.toggle();
        this.audio.playClick();
      } else if (e.key === 'Escape' && this.settings.isOpen) {
        this.settings.close();
      }
    });
  }

  // ── Game Loop Wiring ────────────────────
  private _registerLoopCallbacks(): void {
    // 1. Fixed physics / gameplay update tick (60 Hz)
    this.loop.addUpdatable({
      update: (dt: number) => this._fixedUpdate(dt),
    });

    // 2. Variable frame rendering & camera follow
    this.loop.addRenderCallback(() => this._renderFrame());

    this.loop.start();
  }

  // ── Loading Sequence ────────────────────
  private _runLoadingSequence(): void {
    TrafficModelLoader.preloadAll();

    let progress = 0;
    const interval = setInterval(() => {
      progress = Math.min(100, progress + 12);
      this.hud.setLoadingProgress(progress);

      if (progress >= 100) {
        clearInterval(interval);
        setTimeout(() => {
          this.hud.hideLoading();
          this._showMenu();
        }, 300);
      }
    }, 50);
  }

  // ── State Transitions ───────────────────
  private _showMenu(): void {
    this.state = 'MENU';
    this.hud.hide();
    this.hud.hideGameOver();
    this._updateMenuStats();
    this.hud.showMenu();
    this.audio.stopAll();
    this.speedLines.reset();
  }

  private _updateMenuStats(): void {
    this.hud.setBestScores(
      this.score.bestScore,
      Math.floor(this.score.bestDistance),
      this.score.careerCoins
    );
  }

  private _startCountdown(): void {
    this.state = 'COUNTDOWN';
    this._resetGameState();

    this.hud.hideMenu();
    this.hud.hideGameOver();
    this.hud.show();
    this.hud.showStartGuide();

    this.countdownStep = 3;
    this.countdownTimer = 0;
    this.hud.showCenterText('3');
    this.audio.playBeep(false);
  }

  private _startGameplay(): void {
    this.state = 'PLAYING';
    this.hud.hideStartGuide();
    this.hud.showCenterText('GO!');
    this.audio.playBeep(true);
    setTimeout(() => this.hud.hideCenterText(), 700);

    this.audio.playEngine();
    this.audio.startBGM();
  }

  private _togglePause(): void {
    if (this.state === 'PLAYING') {
      this.state = 'PAUSED';
      this.hud.showCenterText('PAUSED');
      this.audio.pause();
      this.speedLines.reset();
    } else if (this.state === 'PAUSED') {
      this.state = 'PLAYING';
      this.hud.hideCenterText();
      this.audio.resume();
    }
  }

  private _toggleMute(): void {
    const isMuted = this.audio.toggleMute();
    const muteBtn = document.getElementById('mute-btn');
    if (muteBtn) {
      muteBtn.classList.toggle('active', isMuted);
    }
  }

  private _resetGameState(): void {
    this.player.reset();
    this.pool.reset();
    this.spawn.reset();
    this.coins.reset();
    this.score.reset();
    this.speedLines.reset();

    this.hud.setScore(0);
    this.hud.setDistance(0);
    this.hud.setCoins(0, false);
    this.hud.setAir(600);
    this.hud.setFever(0);
    this.hud.hideCombo(0);
  }

  private _triggerGameOver(): void {
    this.state = 'GAME_OVER';
    this.audio.playCrash();
    this.audio.stopAll();
    this.speedLines.reset();

    this.hud.flash(250);

    const isRecord = this.score.saveBest();
    const timeStr = this.score.getTimeString();

    setTimeout(() => {
      this.hud.showGameOver(
        this.score.score,
        this.score.distance,
        timeStr,
        isRecord,
        this.score.coins,
        this.score.careerCoins
      );
    }, 600);
  }

  // ── Fixed Timestep Update ───────────────
  private _fixedUpdate(dt: number): void {
    const inputState = this.input.read();

    // Menu / Game Over quick restarts via keyboard
    if (inputState.action || inputState.slam) {
      if (this.state === 'MENU' && !this.settings.isOpen) {
        this._startCountdown();
        return;
      }
      if (this.state === 'GAME_OVER' && !this.settings.isOpen) {
        this._startCountdown();
        return;
      }
    }

    if (inputState.pause) {
      this._togglePause();
    }
    if (inputState.mute) {
      this._toggleMute();
    }

    // Handle Countdown timer
    if (this.state === 'COUNTDOWN') {
      this.countdownTimer += dt;
      if (this.countdownTimer >= 0.8) {
        this.countdownTimer -= 0.8;
        this.countdownStep--;
        if (this.countdownStep === 2) {
          this.hud.showCenterText('2');
          this.audio.playBeep(false);
        } else if (this.countdownStep === 1) {
          this.hud.showCenterText('1');
          this.audio.playBeep(false);
        } else if (this.countdownStep === 0) {
          this._startGameplay();
        }
      }
      // Keep road, sky & coins subtly alive during countdown
      this.pool.advanceWorld(8 * dt, dt, 0, 0);
      this.pool.recycleChunks(this.engine.camera.position.z);
      this.coins.update(dt, 8 * dt);
      return;
    }

    if (this.state !== 'PLAYING') return;

    // Trigger fever manually if full and action pressed or auto-trigger
    if (this.score.feverMeter >= 100 && !this.score.feverActive && inputState.boost) {
      this.score.activateFever();
    }

    // ── Player Update ──
    this.player.setInput(inputState);
    this.player.update(dt);

    // Trick checking
    if (this.player.justCompletedTrick) {
      this.score.registerTrick(this.player.justCompletedTrick);
    }

    // Slam landing
    if (this.player.justLandedSlam) {
      this.hud.flash(80);
    }

    // Boost audio
    if (this.player.isBoosting) {
      this.audio.playThruster();
    } else {
      this.audio.stopThruster();
    }

    // Hover audio
    this.audio.setHover(this.player.isHovering);

    // ── World Speed & Movement ──
    const baseSpeed = 40 + Math.min(38, this.score.distance * 0.02);
    const boostMultiplier = this.player.isBoosting ? 1.6 : 1.0;
    const worldSpeed = baseSpeed * boostMultiplier;
    const moveDelta = worldSpeed * dt;

    this.pool.advanceWorld(moveDelta, dt, this.player.mesh.position.z, this.player.mesh.position.x);
    this.pool.recycleChunks(this.engine.camera.position.z);

    // Coins update & collection check (Subway Surfers style)
    this.coins.update(dt, moveDelta);
    this.coins.checkCollisions(
      this.player.mesh.position.x,
      this.player.positionY,
      this.player.mesh.position.z
    );

    // Distance & Spawn update
    this.score.addDistance(moveDelta);
    this.spawn.setDistance(this.score.distance);
    this.spawn.update(dt);
    this.score.updateCombo(dt);

    // Audio engine pitch
    this.audio.setEnginePitch((worldSpeed - 40) / 45);

    // ── Collision & Near-Miss Detection ──
    this._checkCollisions();

    // ── Update HUD elements ──
    this.hud.setDistance(this.score.distance);
    this.hud.setAir(this.player.air);
    this.hud.setFever(this.score.feverMeter);
  }

  // ── Collision Math (Analytical AABB) ────
  private _checkCollisions(): void {
    const pBox = this.player.getAABB();
    const activeTraffic = this.pool.getActiveTraffic();

    for (const car of activeTraffic) {
      const carZ = car.mesh.position.z;
      const playerZ = this.player.mesh.position.z;

      // Spatial culling: only test cars within 6m Z distance
      if (Math.abs(carZ - playerZ) > 6.0) continue;

      const cBox = car.getAABB();

      // Check AABB overlap
      const overlapX = pBox.minX <= cBox.maxX && pBox.maxX >= cBox.minX;
      const overlapY = pBox.minY <= cBox.maxY && pBox.maxY >= cBox.minY;
      const overlapZ = pBox.minZ <= cBox.maxZ && pBox.maxZ >= cBox.minZ;

      if (overlapX && overlapY && overlapZ) {
        if (this.score.feverActive) {
          // Invincible Rocket Mode — plow through obstacles!
          this.pool.releaseTraffic(car);
          this.score.score += 250;
          this.hud.setScore(this.score.score);
          this.hud.showPopup('ROCKET SMASH +250');
          this.hud.flash(80);
        } else {
          // Lethal crash
          this._triggerGameOver();
          return;
        }
      } else if (!car.nearMissed) {
        // Near-miss check: closely passing alongside or jumping right over
        const closeX = Math.abs(car.mesh.position.x - this.player.mesh.position.x) < 2.5;
        const closeY = Math.abs(this.player.positionY - cBox.maxY) < 1.3;
        const passingZ = carZ >= playerZ - 0.8 && carZ <= playerZ + 2.0;

        if (passingZ && (closeX || closeY)) {
          car.nearMissed = true;
          this.score.registerNearMiss();
          const pan = (car.mesh.position.x - this.player.mesh.position.x) / 5;
          this.audio.playWhoosh(pan);
          car.reactToPlayerNearMiss();
        }
      }
    }
  }

  // ── Per-Frame Rendering & Camera Interpolation ──
  private _renderFrame(): void {
    const dt = this.loop.fixedDt;

    // Update high-speed wind streaks — ONLY when playing and moving faster (boosting or rocket fever)
    if (this.state === 'PLAYING') {
      if (this.settings.settings.speedLinesEnabled) {
        const baseSpeed = 40 + Math.min(38, this.score.distance * 0.02);
        this.speedLines.update(dt, baseSpeed, this.player.isBoosting, this.score.feverActive);
      } else {
        this.speedLines.reset();
      }
    } else {
      this.speedLines.reset();
    }

    const playerPos = this.player.mesh.position;
    const targetCamPos = new THREE.Vector3();
    const targetLookAt = new THREE.Vector3();

    if (this.state === 'MENU') {
      // ── Clean Cinematic Menu Camera (Player Preview Removed) ──
      // Fixed elegant isometric view of the Roadster at the starting line
      this.targetFov = 34;
      targetCamPos.set(4.4, 1.8, 8.2);
      targetLookAt.set(0, 0.55, -0.8);

      this.curCamPos.lerp(targetCamPos, 0.08);
      this.curCamLookAt.lerp(targetLookAt, 0.08);

      this.engine.camera.position.copy(this.curCamPos);
      this.engine.camera.lookAt(this.curCamLookAt);
    } else {
      // ── Gameplay Chase Camera Follow ──
      const u = (decay: number) => 1 - Math.exp(-decay * dt);

      // Smooth horizontal follow with responsive damping
      const targetCamX = playerPos.x * 0.82;
      this.camX += (targetCamX - this.camX) * u(9);

      // Height: base 4.1, tracks jump elevation smoothly
      const targetCamY = 4.1 + this.player.positionY * 0.7;
      this.camY += (targetCamY - this.camY) * u(this.player.positionY > 0.1 ? 8 : 10);

      // Distance behind car: 6.6m (close-up cinematic feel like Roadster Dash), expands slightly during boost
      const backDist = 6.6 + (this.player.isBoosting ? 0.7 : 0);

      targetCamPos.set(this.camX, this.camY, backDist);
      targetLookAt.set(this.camX * 0.6 + playerPos.x * 0.4, 2.3 + this.player.positionY * 0.9, -18);

      this.curCamPos.lerp(targetCamPos, 0.12);
      this.curCamLookAt.lerp(targetLookAt, 0.12);

      this.engine.camera.position.copy(this.curCamPos);
      this.engine.camera.lookAt(this.curCamLookAt);

      this.targetFov = this.player.isBoosting ? 76 : 70;
    }

    this.currentFov += (this.targetFov - this.currentFov) * 0.08;
    this.engine.camera.fov = this.currentFov;
    this.engine.camera.updateProjectionMatrix();

    // Render with Bloom or Standard Pass based on settings
    if (this.settings.settings.bloomEnabled) {
      this.postProcess.render();
    } else {
      this.engine.renderer.render(this.engine.scene, this.engine.camera);
    }
  }
}

// ── Bootstrap on DOM load ─────────────────
window.addEventListener('DOMContentLoaded', () => {
  new RoadsterDashGame();
});
