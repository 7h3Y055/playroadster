/**
 * SpeedLinesVFX.ts — High-velocity wind streaks and speed lines.
 * Replicates the intense motion-blur speed lines seen in Roadster Dash at 200+ MPH.
 * Zero-allocation GPU instanced line cylinders.
 */
import * as THREE from 'three';

const MAX_STREAKS = 140;

interface Streak {
  active: boolean;
  x: number;
  y: number;
  z: number;
  speed: number;
  length: number;
}

export class SpeedLinesVFX {
  private readonly streaks: Streak[] = [];
  private readonly instancedMesh: THREE.InstancedMesh;
  private readonly dummy = new THREE.Object3D();
  private activeCount = 80;

  constructor(scene: THREE.Scene) {
    for (let i = 0; i < MAX_STREAKS; i++) {
      this.streaks.push({
        active: true,
        x: (Math.random() > 0.5 ? 1 : -1) * (4.5 + Math.random() * 8.0),
        y: 0.5 + Math.random() * 4.5,
        z: -120 + Math.random() * 140,
        speed: 1.0 + Math.random() * 0.5,
        length: 3.0 + Math.random() * 5.0,
      });
    }

    // Thin glowing white cylinder oriented along Z axis
    const geo = new THREE.CylinderGeometry(0.02, 0.02, 1, 4);
    geo.rotateX(Math.PI / 2); // Orient along Z

    const mat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });

    this.instancedMesh = new THREE.InstancedMesh(geo, mat, MAX_STREAKS);
    this.instancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.instancedMesh.frustumCulled = false;
    this.instancedMesh.visible = false;

    scene.add(this.instancedMesh);
  }

  /** Set active streaks count based on graphics mode */
  public setActiveCount(count: number): void {
    const prevCount = this.activeCount;
    this.activeCount = Math.max(0, Math.min(count, MAX_STREAKS));

    // Hide newly deactivated streaks
    for (let i = this.activeCount; i < MAX_STREAKS; i++) {
      this.dummy.position.set(0, -999, 0);
      this.dummy.scale.set(0, 0, 0);
      this.dummy.updateMatrix();
      this.instancedMesh.setMatrixAt(i, this.dummy.matrix);
    }
    if (this.activeCount < prevCount) {
      this.instancedMesh.instanceMatrix.needsUpdate = true;
    }
  }

  /** Immediately hide all speed lines */
  public reset(): void {
    const material = this.instancedMesh.material as THREE.MeshBasicMaterial;
    material.opacity = 0;
    this.instancedMesh.visible = false;
  }

  /**
   * Only animates and displays speed lines when the car is moving faster (boosting or high speed).
   */
  public update(dt: number, worldSpeed: number, isBoosting: boolean, isHighSpeed = false): void {
    if (this.activeCount === 0 || dt <= 0) return;

    // Strict: Only active when car is moving faster (boosting or rocket fever)
    const shouldShow = isBoosting || isHighSpeed;
    const material = this.instancedMesh.material as THREE.MeshBasicMaterial;

    if (!shouldShow) {
      if (material.opacity > 0.01) {
        material.opacity = Math.max(0, material.opacity - dt * 5.0);
        this.instancedMesh.visible = material.opacity > 0.01;
      } else {
        material.opacity = 0;
        this.instancedMesh.visible = false;
        return;
      }
    } else {
      this.instancedMesh.visible = true;
      const targetOpacity = isBoosting ? 0.85 : 0.65;
      material.opacity += (targetOpacity - material.opacity) * Math.min(1, dt * 6.0);
    }

    const boostMult = isBoosting ? 2.4 : 1.8;
    const streakSpeed = (worldSpeed * 2.0 + 50) * boostMult;

    for (let i = 0; i < this.activeCount; i++) {
      const s = this.streaks[i]!;

      // Move toward camera
      s.z += streakSpeed * s.speed * dt;

      // When passing behind camera, respawn far ahead
      if (s.z > 25) {
        s.z = -130 - Math.random() * 40;
        s.x = (Math.random() > 0.5 ? 1 : -1) * (3.8 + Math.random() * 8.0);
        s.y = 0.4 + Math.random() * 4.6;
        s.length = isBoosting ? 7.5 + Math.random() * 6.5 : 4.0 + Math.random() * 4.5;
      }

      this.dummy.position.set(s.x, s.y, s.z);
      this.dummy.scale.set(1, 1, s.length);
      this.dummy.updateMatrix();
      this.instancedMesh.setMatrixAt(i, this.dummy.matrix);
    }

    this.instancedMesh.instanceMatrix.needsUpdate = true;
  }
}

