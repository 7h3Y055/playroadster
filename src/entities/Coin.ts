/**
 * Coin.ts — 3D Gold Token / Collectible Coin (like Subway Surfers).
 * Features high-luster metallic gold shading, continuous spin, floating hover bob,
 * and a punchy collection pop-out animation.
 */
import * as THREE from 'three';

// Shared geometries and materials across all coin instances for peak performance
let sharedCoinGeo: THREE.CylinderGeometry | null = null;
let sharedRimGeo: THREE.TorusGeometry | null = null;
let sharedStarGeo: THREE.BufferGeometry | null = null;
let sharedGoldMat: THREE.MeshStandardMaterial | null = null;
let sharedEmblemMat: THREE.MeshStandardMaterial | null = null;

function getSharedResources() {
  if (!sharedCoinGeo) {
    // Upright gold coin disk (diameter 0.88m, thickness 0.12m)
    sharedCoinGeo = new THREE.CylinderGeometry(0.44, 0.44, 0.12, 18);
    // Rotate so coin stands vertically facing forward / camera
    sharedCoinGeo.rotateX(Math.PI / 2);

    // Outer beveled rim
    sharedRimGeo = new THREE.TorusGeometry(0.43, 0.045, 8, 20);

    // Embossed star / emblem in coin center
    const shape = new THREE.Shape();
    const points = 5;
    const outerR = 0.24;
    const innerR = 0.11;
    for (let i = 0; i < points * 2; i++) {
      const angle = (i * Math.PI) / points - Math.PI / 2;
      const r = i % 2 === 0 ? outerR : innerR;
      const x = Math.cos(angle) * r;
      const y = Math.sin(angle) * r;
      if (i === 0) shape.moveTo(x, y);
      else shape.lineTo(x, y);
    }
    shape.closePath();

    sharedStarGeo = new THREE.ShapeGeometry(shape);

    // Brilliant reflective metallic gold
    sharedGoldMat = new THREE.MeshStandardMaterial({
      color: 0xffd000,
      roughness: 0.18,
      metalness: 0.88,
      emissive: 0xff9900,
      emissiveIntensity: 0.38,
    });

    // Slightly lighter gold for center emblem
    sharedEmblemMat = new THREE.MeshStandardMaterial({
      color: 0xfff066,
      roughness: 0.12,
      metalness: 0.95,
      emissive: 0xffaa00,
      emissiveIntensity: 0.65,
    });
  }

  return {
    coinGeo: sharedCoinGeo!,
    rimGeo: sharedRimGeo!,
    starGeo: sharedStarGeo!,
    goldMat: sharedGoldMat!,
    emblemMat: sharedEmblemMat!,
  };
}

export class Coin {
  public readonly mesh: THREE.Group;
  public active = false;
  public collected = false;

  public lane = 0;
  public baseY = 0.65;
  public isArc = false;
  private bobTimer = 0;
  private readonly bobPhase: number;
  private collectTimer = 0;

  // Analytical collision radius
  public readonly radius = 1.35;

  constructor() {
    this.mesh = new THREE.Group();
    this.bobPhase = Math.random() * Math.PI * 2;

    const res = getSharedResources();

    // 1. Coin Main Body
    const coinMesh = new THREE.Mesh(res.coinGeo, res.goldMat);
    coinMesh.castShadow = true;
    this.mesh.add(coinMesh);

    // 2. Beveled Rim
    const rimMesh = new THREE.Mesh(res.rimGeo, res.goldMat);
    this.mesh.add(rimMesh);

    // 3. Front & Back Embossed Star Emblems
    const frontStar = new THREE.Mesh(res.starGeo, res.emblemMat);
    frontStar.position.z = 0.065;
    this.mesh.add(frontStar);

    const backStar = new THREE.Mesh(res.starGeo, res.emblemMat);
    backStar.position.z = -0.065;
    backStar.rotation.y = Math.PI;
    this.mesh.add(backStar);

    this.mesh.visible = false;
  }

  /** Spawn and place this coin in the world */
  public spawn(lane: number, x: number, y: number, z: number, isArc = false): void {
    this.lane = lane;
    this.baseY = y;
    this.isArc = isArc;
    this.mesh.position.set(x, y, z);
    this.mesh.scale.set(1, 1, 1);
    this.mesh.rotation.set(0, this.bobPhase, 0);

    this.active = true;
    this.collected = false;
    this.collectTimer = 0;
    this.mesh.visible = true;
  }

  /** Trigger satisfying collection pop animation */
  public collect(): void {
    if (this.collected) return;
    this.collected = true;
    this.collectTimer = 0;
  }

  /** Soft magnetic pull towards player vehicle */
  public attractTowards(targetX: number, targetY: number, factor: number): void {
    if (!this.active || this.collected) return;
    this.mesh.position.x += (targetX - this.mesh.position.x) * factor;
    this.mesh.position.y += (targetY - this.mesh.position.y) * factor;
  }

  /** Update coin animation and world movement */
  public update(dt: number, worldMoveDelta: number): void {
    if (!this.active) return;

    this.bobTimer += dt;

    if (this.collected) {
      // Fast juicy pop-out: scale up, fly up, and vanish
      this.collectTimer += dt;
      const progress = this.collectTimer / 0.24;

      const scale = 1.0 + Math.sin(progress * Math.PI) * 0.55;
      this.mesh.scale.set(scale, scale, scale);
      this.mesh.position.y += 5.5 * dt;
      this.mesh.position.z += worldMoveDelta * 0.4;
      this.mesh.rotation.y += 18 * dt;

      if (progress >= 1.0) {
        this.deactivate();
      }
      return;
    }

    // Continuous spin
    this.mesh.rotation.y += 4.5 * dt;

    // Gentle floating bob for ground coins; arc coins stay locked to their exact trajectory curve
    if (!this.isArc) {
      this.mesh.position.y = this.baseY + Math.sin(this.bobTimer * 4.2 + this.bobPhase) * 0.12;
    }

    // Advance toward camera with road movement
    this.mesh.position.z += worldMoveDelta;

    // Despawn when passed behind player camera (> 20m)
    if (this.mesh.position.z > 20) {
      this.deactivate();
    }
  }

  /** Return coin to pool */
  public deactivate(): void {
    this.active = false;
    this.collected = false;
    this.isArc = false;
    this.mesh.visible = false;
    this.mesh.position.set(0, -100, 0);
  }
}
