/**
 * TrafficModelLoader.ts — Preloads and clones realistic civilian traffic 3D models.
 * Uses free CC0 Kenney 3D vehicles (sedan, SUV, van, taxi, delivery, sports, hatchback).
 * Configures automotive materials, extracts rotating wheel nodes, and adds glowing rear taillights.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export type TrafficModelType =
  | 'sedan'
  | 'suv'
  | 'van'
  | 'taxi'
  | 'sedan-sports'
  | 'delivery'
  | 'hatchback';

export const TRAFFIC_MODEL_TYPES: TrafficModelType[] = [
  'sedan',
  'suv',
  'van',
  'taxi',
  'sedan-sports',
  'delivery',
  'hatchback',
];

interface ModelTemplate {
  scene: THREE.Group;
  halfW: number;
  halfH: number;
  halfL: number;
  wheelNames: string[];
  frontWheelNames: string[];
}

export interface ClonedCarInstance {
  group: THREE.Group;
  wheels: THREE.Object3D[];
  frontWheels: THREE.Object3D[];
  halfW: number;
  halfH: number;
  halfL: number;
}

const MODEL_CONFIGS: Record<TrafficModelType, { file: string; scale: number; halfW: number; halfH: number; halfL: number }> = {
  'sedan':         { file: '/assets/models/sedan.glb',            scale: 1.25, halfW: 0.94, halfH: 0.72, halfL: 1.60 },
  'suv':           { file: '/assets/models/suv.glb',              scale: 1.25, halfW: 0.94, halfH: 0.75, halfL: 1.60 },
  'van':           { file: '/assets/models/van.glb',              scale: 1.22, halfW: 0.92, halfH: 0.78, halfL: 1.72 },
  'taxi':          { file: '/assets/models/taxi.glb',             scale: 1.22, halfW: 0.92, halfH: 0.78, halfL: 1.72 },
  'sedan-sports':  { file: '/assets/models/sedan-sports.glb',     scale: 1.25, halfW: 0.94, halfH: 0.72, halfL: 1.60 },
  'delivery':      { file: '/assets/models/delivery.glb',         scale: 1.18, halfW: 0.95, halfH: 0.88, halfL: 1.80 },
  'hatchback':     { file: '/assets/models/hatchback-sports.glb', scale: 1.25, halfW: 0.94, halfH: 0.72, halfL: 1.65 },
};

export class TrafficModelLoader {
  private static templates: Map<TrafficModelType, ModelTemplate> = new Map();
  private static loadingPromise: Promise<void> | null = null;
  private static isReady = false;

  public static isLoaded(): boolean {
    return this.isReady;
  }

  /** Preload all 7 normal car models concurrently */
  public static preloadAll(): Promise<void> {
    if (this.loadingPromise) return this.loadingPromise;

    const loader = new GLTFLoader();
    const promises = TRAFFIC_MODEL_TYPES.map((type) => {
      const cfg = MODEL_CONFIGS[type];
      return new Promise<void>((resolve) => {
        loader.load(
          cfg.file,
          (gltf) => {
            const root = gltf.scene;

            // Tune materials for glossy automotive look
            root.traverse((child) => {
              if ((child as THREE.Mesh).isMesh) {
                const mesh = child as THREE.Mesh;
                mesh.castShadow = true;
                mesh.receiveShadow = true;

                if (mesh.material) {
                  const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
                  for (const mat of mats) {
                    if (mat instanceof THREE.MeshStandardMaterial) {
                      mat.roughness = 0.28;
                      mat.metalness = 0.20;
                      mat.envMapIntensity = 1.0;
                    }
                  }
                }
              }
            });

            // Rotate 180° around Y to face forward along -Z (driving in same direction as player)
            root.rotation.y = Math.PI;
            root.scale.set(cfg.scale, cfg.scale, cfg.scale);

            // Discover wheel nodes for animation and steering
            const wheelNames: string[] = [];
            const frontWheelNames: string[] = [];
            root.traverse((node) => {
              const n = node.name.toLowerCase();
              if (n.includes('wheel') && !n.includes('back-spare') && n !== 'wheel-back') {
                wheelNames.push(node.name);
                if (n.includes('front')) {
                  frontWheelNames.push(node.name);
                }
              }
            });

            this.templates.set(type, {
              scene: root,
              halfW: cfg.halfW,
              halfH: cfg.halfH,
              halfL: cfg.halfL,
              wheelNames,
              frontWheelNames,
            });

            resolve();
          },
          undefined,
          (err) => {
            console.warn(`[TrafficModelLoader] Failed to load ${cfg.file}, using procedural fallback:`, err);
            resolve(); // Don't reject, allow game to proceed with fallback
          }
        );
      });
    });

    this.loadingPromise = Promise.all(promises).then(() => {
      this.isReady = true;
    });

    return this.loadingPromise;
  }

  /** Clone an instance of a normal car model */
  public static cloneCar(type: TrafficModelType): ClonedCarInstance | null {
    const tmpl = this.templates.get(type);
    if (!tmpl) return null;

    const clonedGroup = tmpl.scene.clone(true);
    const wheels: THREE.Object3D[] = [];
    const frontWheels: THREE.Object3D[] = [];

    for (const name of tmpl.wheelNames) {
      const w = clonedGroup.getObjectByName(name);
      if (w) wheels.push(w);
    }

    for (const name of tmpl.frontWheelNames) {
      const w = clonedGroup.getObjectByName(name);
      if (w) frontWheels.push(w);
    }

    return {
      group: clonedGroup,
      wheels,
      frontWheels,
      halfW: tmpl.halfW,
      halfH: tmpl.halfH,
      halfL: tmpl.halfL,
    };
  }
}
