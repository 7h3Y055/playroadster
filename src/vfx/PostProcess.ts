/**
 * PostProcess.ts — Bloom and color grading via EffectComposer.
 * UnrealBloomPass tuned so only emissive elements (LED lights, lane markers, thrusters) glow.
 */
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

export class PostProcess {
  public readonly composer: EffectComposer;
  private readonly bloomPass: UnrealBloomPass;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.Camera;
  public enabled = true;

  constructor(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.composer = new EffectComposer(renderer);

    // ── Render Pass ──────────────────────
    const renderPass = new RenderPass(scene, camera);
    this.composer.addPass(renderPass);

    // ── Bloom Pass (gentle, subtle glow on LED bars and thrusters) ──
    const resolution = new THREE.Vector2(window.innerWidth, window.innerHeight);
    this.bloomPass = new UnrealBloomPass(
      resolution,
      0.5,    // Gentle Strength — no glare blowout
      0.35,   // Radius
      0.90    // High Threshold — only bright emissives glow
    );
    this.composer.addPass(this.bloomPass);

    // ── Output Pass (tone mapping + color space) ──
    const outputPass = new OutputPass();
    this.composer.addPass(outputPass);

    // ── Resize handling ──────────────────
    window.addEventListener('resize', this._onResize);
  }

  /** Apply graphics preset settings */
  public applyGraphicsPreset(preset: {
    bloomEnabled: boolean;
    bloomStrength: number;
    bloomRadius: number;
    pixelRatio: number;
  }): void {
    this.enabled = preset.bloomEnabled;
    this.bloomPass.strength = preset.bloomStrength;
    this.bloomPass.radius = preset.bloomRadius;
    this.composer.setPixelRatio(preset.pixelRatio);
    this.composer.setSize(window.innerWidth, window.innerHeight);
  }

  /** Render the post-processing pipeline (bypassed in Low mode for max performance) */
  public render(): void {
    if (!this.enabled) {
      this.renderer.render(this.scene, this.camera);
      return;
    }
    this.composer.render();
  }

  /** Set bloom intensity (for dynamic adjustments) */
  public setBloomStrength(strength: number): void {
    this.bloomPass.strength = strength;
  }

  public setBloomThreshold(threshold: number): void {
    this.bloomPass.threshold = threshold;
  }

  private _onResize = (): void => {
    this.composer.setSize(window.innerWidth, window.innerHeight);
  };

  public dispose(): void {
    window.removeEventListener('resize', this._onResize);
  }
}

