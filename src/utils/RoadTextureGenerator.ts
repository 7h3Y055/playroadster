/**
 * RoadTextureGenerator.ts — Generates high-fidelity procedural asphalt textures
 * including aggregate stone noise, worn tire tracks in each lane, polished specular maps,
 * and high-frequency pebble bump maps.
 * Cached as singletons to ensure zero runtime overhead and optimal GPU texture caching.
 */
import * as THREE from 'three';

export interface RoadTextures {
  diffuse: THREE.CanvasTexture;
  roughness: THREE.CanvasTexture;
  bump: THREE.CanvasTexture;
}

export class RoadTextureGenerator {
  private static instance: RoadTextures | null = null;

  public static getTextures(): RoadTextures {
    if (this.instance) return this.instance;

    const width = 1024;  // Across road width (11.5m)
    const height = 1024; // Along chunk length (50m)

    // ── 1. Create Diffuse Canvas ─────────────────────
    const diffCanvas = document.createElement('canvas');
    diffCanvas.width = width;
    diffCanvas.height = height;
    const diffCtx = diffCanvas.getContext('2d')!;

    // ── 2. Create Roughness Canvas ───────────────────
    const roughCanvas = document.createElement('canvas');
    roughCanvas.width = width;
    roughCanvas.height = height;
    const roughCtx = roughCanvas.getContext('2d')!;

    // ── 3. Create Bump Canvas ────────────────────────
    const bumpCanvas = document.createElement('canvas');
    bumpCanvas.width = width;
    bumpCanvas.height = height;
    const bumpCtx = bumpCanvas.getContext('2d')!;

    // Base tone: dark charcoal asphalt
    diffCtx.fillStyle = '#222429';
    diffCtx.fillRect(0, 0, width, height);

    roughCtx.fillStyle = '#a0a0a0'; // Base roughness ~0.63
    roughCtx.fillRect(0, 0, width, height);

    bumpCtx.fillStyle = '#808080';
    bumpCtx.fillRect(0, 0, width, height);

    // ── Aggregate Stone Grain & Bitumen Flecks ──────
    const diffImg = diffCtx.getImageData(0, 0, width, height);
    const roughImg = roughCtx.getImageData(0, 0, width, height);
    const bumpImg = bumpCtx.getImageData(0, 0, width, height);

    const diffData = diffImg.data;
    const roughData = roughImg.data;
    const bumpData = bumpImg.data;

    // Lane wheel track X centers in normalized coordinates [0..1]
    // Road width is 11.5m (-5.75m to +5.75m).
    // Lanes: Left (-3.5m), Center (0.0m), Right (+3.5m)
    // Left lane wheel centers: -4.25m and -2.75m -> norm: 0.130 and 0.261
    // Center lane wheel centers: -0.75m and +0.75m -> norm: 0.435 and 0.565
    // Right lane wheel centers: +2.75m and +4.25m -> norm: 0.739 and 0.870
    const wheelTracks = [0.130, 0.261, 0.435, 0.565, 0.739, 0.870];
    const wheelRadiusNorm = 0.038; // ~0.44m wide tire track

    // Fast deterministic PRNG for procedural reproducibility
    let seed = 42;
    const random = () => {
      seed = (seed * 16807 + 0) % 2147483647;
      return (seed - 1) / 2147483646;
    };

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        const normX = x / width;

        // Base asphalt grain noise
        const r1 = random();
        const r2 = random();
        const aggregate = (r1 - 0.5) * 32 + (r2 - 0.5) * 16;

        let r = 36 + aggregate;
        let g = 38 + aggregate;
        let b = 43 + aggregate;
        let rough = 165; // ~0.65 roughness base
        let bump = 128 + (r1 - 0.5) * 50;

        // Calculate distance to nearest wheel track
        let minWheelDist = 999;
        for (const wt of wheelTracks) {
          const d = Math.abs(normX - wt);
          if (d < minWheelDist) minWheelDist = d;
        }

        // Apply worn tire track rubber darkening and specular polishing
        if (minWheelDist < wheelRadiusNorm) {
          const t = 1.0 - (minWheelDist / wheelRadiusNorm);
          const factor = Math.cos(t * Math.PI * 0.5); // Smooth falloff
          const darkAmount = (1.0 - factor) * 12;

          r = Math.max(16, r - darkAmount);
          g = Math.max(18, g - darkAmount);
          b = Math.max(22, b - darkAmount);

          // Tire tracks are smoothed/polished: lower roughness = more reflective
          rough = Math.max(85, rough - (1.0 - factor) * 75);
          bump = Math.max(100, bump - (1.0 - factor) * 20);
        }

        // Slight center lane oil patina
        const centerLanes = [0.196, 0.500, 0.804];
        for (const cl of centerLanes) {
          const cd = Math.abs(normX - cl);
          if (cd < 0.02) {
            const oil = (1.0 - cd / 0.02) * 6;
            r = Math.max(18, r - oil);
            g = Math.max(19, g - oil);
            b = Math.max(22, b - oil);
            rough = Math.max(90, rough - oil * 5);
          }
        }

        // Shoulder edge grit/roughness
        if (normX < 0.06 || normX > 0.94) {
          rough = Math.min(240, rough + 40);
          r += 10;
          g += 10;
          b += 10;
        }

        diffData[idx] = Math.min(255, Math.max(0, r));
        diffData[idx + 1] = Math.min(255, Math.max(0, g));
        diffData[idx + 2] = Math.min(255, Math.max(0, b));
        diffData[idx + 3] = 255;

        roughData[idx] = rough;
        roughData[idx + 1] = rough;
        roughData[idx + 2] = rough;
        roughData[idx + 3] = 255;

        bumpData[idx] = bump;
        bumpData[idx + 1] = bump;
        bumpData[idx + 2] = bump;
        bumpData[idx + 3] = 255;
      }
    }

    diffCtx.putImageData(diffImg, 0, 0);
    roughCtx.putImageData(roughImg, 0, 0);
    bumpCtx.putImageData(bumpImg, 0, 0);

    // Subtle faint longitudinal paving seams
    diffCtx.fillStyle = 'rgba(15, 17, 20, 0.35)';
    for (const seamX of [width * 0.35, width * 0.65]) {
      diffCtx.fillRect(seamX - 1, 0, 2, height);
    }

    // ── Build Three.js Textures ──────────────────────
    const diffTex = new THREE.CanvasTexture(diffCanvas);
    diffTex.wrapS = THREE.RepeatWrapping;
    diffTex.wrapT = THREE.RepeatWrapping;
    diffTex.anisotropy = 16;
    diffTex.colorSpace = THREE.SRGBColorSpace;

    const roughTex = new THREE.CanvasTexture(roughCanvas);
    roughTex.wrapS = THREE.RepeatWrapping;
    roughTex.wrapT = THREE.RepeatWrapping;
    roughTex.anisotropy = 16;

    const bumpTex = new THREE.CanvasTexture(bumpCanvas);
    bumpTex.wrapS = THREE.RepeatWrapping;
    bumpTex.wrapT = THREE.RepeatWrapping;
    bumpTex.anisotropy = 16;

    this.instance = {
      diffuse: diffTex,
      roughness: roughTex,
      bump: bumpTex,
    };

    return this.instance;
  }

  /** Dynamically adjust texture filtering based on graphics mode */
  public static setAnisotropy(anisotropy: number): void {
    if (!this.instance) return;
    this.instance.diffuse.anisotropy = anisotropy;
    this.instance.roughness.anisotropy = anisotropy;
    this.instance.bump.anisotropy = anisotropy;
    this.instance.diffuse.needsUpdate = true;
    this.instance.roughness.needsUpdate = true;
    this.instance.bump.needsUpdate = true;
  }
}
