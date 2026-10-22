/**
 * GraphicsManager.ts — Manages the 4 graphics fidelity modes:
 * Low, Mid, High, Ultra.
 * Dynamically updates resolution scaling (pixel ratio), shadow maps,
 * bloom post-processing, speed line particle counts, and texture anisotropy.
 * Persists user choice in localStorage.
 */
import * as THREE from 'three';
import { Engine } from '@core/Engine';
import { PostProcess } from '@vfx/PostProcess';
import { SpeedLinesVFX } from '@vfx/SpeedLinesVFX';
import { RoadTextureGenerator } from '@utils/RoadTextureGenerator';

export type GraphicsMode = 'low' | 'mid' | 'high' | 'ultra';

export interface GraphicsPreset {
  id: GraphicsMode;
  name: string;
  sub: string;
  pixelRatio: number;
  shadows: boolean;
  shadowMapSize: number;
  shadowType: THREE.ShadowMapType;
  bloomEnabled: boolean;
  bloomStrength: number;
  bloomRadius: number;
  speedLinesCount: number;
  anisotropy: number;
  description: string;
}

export class GraphicsManager {
  private static readonly STORAGE_KEY = 'roadster_graphics_mode';

  private currentMode: GraphicsMode = 'high';
  private readonly listeners: Array<(mode: GraphicsMode, preset: GraphicsPreset) => void> = [];

  public static readonly PRESETS: Record<GraphicsMode, GraphicsPreset> = {
    low: {
      id: 'low',
      name: 'Low',
      sub: 'PERF',
      pixelRatio: Math.min(window.devicePixelRatio * 0.75, 1.0),
      shadows: false,
      shadowMapSize: 512,
      shadowType: THREE.BasicShadowMap,
      bloomEnabled: false,
      bloomStrength: 0,
      bloomRadius: 0,
      speedLinesCount: 25,
      anisotropy: 1,
      description: '0.75x Resolution · Shadows Off · Post-Process Off · 120 FPS Target',
    },
    mid: {
      id: 'mid',
      name: 'Mid',
      sub: 'BALANCED',
      pixelRatio: 1.0,
      shadows: true,
      shadowMapSize: 1024,
      shadowType: THREE.BasicShadowMap,
      bloomEnabled: true,
      bloomStrength: 0.35,
      bloomRadius: 0.25,
      speedLinesCount: 50,
      anisotropy: 4,
      description: '1.0x Native · Basic Shadows · Light Bloom · Balanced 60 FPS',
    },
    high: {
      id: 'high',
      name: 'High',
      sub: 'RETINA',
      pixelRatio: Math.min(window.devicePixelRatio, 1.5),
      shadows: true,
      shadowMapSize: 2048,
      shadowType: THREE.PCFSoftShadowMap,
      bloomEnabled: true,
      bloomStrength: 0.52,
      bloomRadius: 0.35,
      speedLinesCount: 80,
      anisotropy: 8,
      description: '1.5x HiDPI Retina · Soft PCF Shadows · Full Neon Bloom (Default)',
    },
    ultra: {
      id: 'ultra',
      name: 'Ultra',
      sub: '4K MAX',
      pixelRatio: Math.min(window.devicePixelRatio, 2.0),
      shadows: true,
      shadowMapSize: 4096,
      shadowType: THREE.PCFSoftShadowMap,
      bloomEnabled: true,
      bloomStrength: 0.72,
      bloomRadius: 0.52,
      speedLinesCount: 130,
      anisotropy: 16,
      description: '2.0x Supersampled · 4K Soft Shadows · Cinematic Bloom · Max VFX',
    },
  };

  private readonly engine: Engine;
  private readonly postProcess: PostProcess;
  private readonly speedLines: SpeedLinesVFX;

  constructor(
    engine: Engine,
    postProcess: PostProcess,
    speedLines: SpeedLinesVFX
  ) {
    this.engine = engine;
    this.postProcess = postProcess;
    this.speedLines = speedLines;

    const saved = localStorage.getItem(GraphicsManager.STORAGE_KEY) as GraphicsMode;
    if (saved && GraphicsManager.PRESETS[saved]) {
      this.currentMode = saved;
    } else {
      this.currentMode = 'high';
    }

    this.apply(this.currentMode);
  }

  public getMode(): GraphicsMode {
    return this.currentMode;
  }

  public getPreset(): GraphicsPreset {
    return GraphicsManager.PRESETS[this.currentMode];
  }

  public setMode(mode: GraphicsMode): void {
    if (!GraphicsManager.PRESETS[mode]) return;
    this.currentMode = mode;
    localStorage.setItem(GraphicsManager.STORAGE_KEY, mode);
    this.apply(mode);

    const preset = GraphicsManager.PRESETS[mode];
    for (const listener of this.listeners) {
      listener(mode, preset);
    }
  }

  public cycle(): GraphicsMode {
    const modes: GraphicsMode[] = ['low', 'mid', 'high', 'ultra'];
    const nextIdx = (modes.indexOf(this.currentMode) + 1) % modes.length;
    const nextMode = modes[nextIdx]!;
    this.setMode(nextMode);
    return nextMode;
  }

  public addListener(listener: (mode: GraphicsMode, preset: GraphicsPreset) => void): void {
    this.listeners.push(listener);
  }

  private apply(mode: GraphicsMode): void {
    const preset = GraphicsManager.PRESETS[mode];

    // 1. Engine renderer & shadows
    this.engine.applyGraphicsPreset(preset);

    // 2. Post processing & bloom
    this.postProcess.applyGraphicsPreset(preset);

    // 3. Speed lines VFX particle count
    this.speedLines.setActiveCount(preset.speedLinesCount);

    // 4. Texture anisotropy filtering
    RoadTextureGenerator.setAnisotropy(preset.anisotropy);
  }
}
