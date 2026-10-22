/**
 * ColdGasThrusters.ts — Faithful recreation of the 10-thruster Cold Gas system from Roadster Dash.
 * Features 3 concentric supersonic plume shells (Core with Mach shockwave diamonds,
 * turbulent cold gas stem with frozen moisture ice sparkles, and expanding billowy mixing layer),
 * directional wind bending, and nozzle aperture flare sprites.
 */
import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export type ThrusterId = 'R1' | 'R2' | 'R3' | 'R4' | 'L1' | 'L2' | 'L3' | 'L4' | 'S1' | 'S2';

export const ALL_THRUSTER_IDS: ThrusterId[] = [
  'R1', 'R2', 'R3', 'R4',
  'L1', 'L2', 'L3', 'L4',
  'S1', 'S2',
];

export const REAR_THRUSTERS: ThrusterId[] = ['R1', 'R2', 'R3', 'R4'];
export const LIFT_THRUSTERS: ThrusterId[] = ['L1', 'L2', 'L3', 'L4'];

interface PlumeConfig {
  len: number;
  width: number;
  spread: number;
}

const PLUME_CONFIGS: Record<string, PlumeConfig> = {
  R: { len: 2.3, width: 0.27, spread: 0.78 }, // Rear boost nozzles
  L: { len: 1.6, width: 0.30, spread: 0.52 }, // Lift/hover nozzles
  S: { len: 1.7, width: 0.25, spread: 0.48 }, // Side lane-shift nozzles
};

// ── 1. Shaders (Directly ported from Roadster Dash production) ──
const FR = /* glsl */ `
  attribute float aLayer;
  uniform float uTime;
  uniform float uSeed;
  uniform float uLevel;
  uniform float uSpread;
  uniform vec3 uWind;
  uniform sampler2D uNoise;
  varying vec2 vUv;
  varying float vLayer;
  varying float vAlong;
  varying vec3 vNormalW;
  varying vec3 vViewW;
  void main() {
    vUv = uv;
    vLayer = aLayer;
    float along = position.y;
    vAlong = along;
    vec3 p = position;
    float r = length(p.xz);
    vec2 radial = r > 1e-4 ? p.xz / r : vec2(1.0, 0.0);
    {
      // Radial expansion: narrow at nozzle mouth, expands downstream (length^1.5)
      vec2 rr = aLayer > 1.5 ? vec2(0.24, 1.25) : aLayer > 0.5 ? vec2(0.14, 0.82) : vec2(0.08, 0.36);
      float t = clamp(uv.y, 0.0, 1.0);
      r = rr.x + (rr.y - rr.x) * pow(t, 1.5) * mix(1.0, uSpread, t);
      p.xz = radial * r;
    }
    if (aLayer > 0.5) {
      // Bell flare downstream
      float bell = 1.0 + 0.55 * uSpread * along * along;
      vec4 n = texture2D(uNoise, vec2(uv.x * 2.0 + uSeed, along * 0.6 - uTime * 1.5));
      vec4 m = texture2D(uNoise, vec2(uv.x * 1.0 - uSeed * 0.7, along * 0.4 - uTime * 0.9 + 0.37));
      float grow = smoothstep(0.08, 0.95, along) * (aLayer > 1.5 ? 1.9 : 1.3) * (0.4 + 0.6 * uSpread);
      float puff = (n.b * 0.65 + m.r * 0.55 - 0.55) * grow;
      p.xz = radial * r * bell * (1.0 + puff);

      // Downstream subtle turbulent wobble
      float wob = along * along * 0.26;
      p.x += sin(uTime * 7.1 + along * 3.0 + uSeed * 5.0) * wob;
      p.z += cos(uTime * 6.3 + along * 2.6 + uSeed * 3.0) * wob;
    }
    vec4 world = modelMatrix * vec4(p, 1.0);
    // Relative air stream bends plume backward
    float bend = along * along * (aLayer < 0.5 ? 0.25 : 1.0);
    world.xyz += uWind * bend * (0.55 + 0.45 * uLevel);
    vNormalW = normalize(mat3(modelMatrix) * normal);
    vViewW = normalize(cameraPosition - world.xyz);
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const BR = /* glsl */ `
  uniform float uLevel;
  uniform float uTime;
  uniform float uSeed;
  uniform vec3 uLight;
  uniform vec3 uSun;
  uniform sampler2D uNoise;
  varying vec2 vUv;
  varying float vLayer;
  varying float vAlong;
  varying vec3 vNormalW;
  varying vec3 vViewW;
  float plumeHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  void main() {
    float along = vUv.y;
    float around = vUv.x;
    vec3 nW = normalize(vNormalW);
    float facing = abs(dot(nW, normalize(vViewW)));
    vec4 slow = texture2D(uNoise, vec2(around * 2.0 + uSeed, vAlong * 1.3 - uTime * 2.2));
    vec4 fast = texture2D(uNoise, vec2(around * 3.0 + uSeed * 1.7, vAlong * 2.6 - uTime * 4.4));
    vec4 big  = texture2D(uNoise, vec2(around * 1.0 - uSeed, vAlong * 0.55 - uTime * 1.1 + 0.5));

    // Sunlit side is brilliant ice-white, shaded side retains cold gas volume
    float lit = 0.62 + 0.48 * max(dot(nW, uSun), 0.0);
    vec3 shade = mix(vec3(0.66, 0.68, 0.74), vec3(1.0), clamp(lit * (0.55 + 0.45 * facing), 0.0, 1.0));
    float alpha;
    vec3 color;
    if (vLayer < 0.5) {
      // ── Core: Supersonic jet column with Mach shockwave diamonds ──
      float body = smoothstep(0.2, 0.75, facing);
      float diamonds = 0.84 + 0.16 * cos(along * 31.4);
      alpha = body * (1.0 - smoothstep(0.2, 1.0, along)) * (0.78 + 0.22 * fast.g);
      color = uLight * 1.25 * diamonds + vec3(0.5 * (1.0 - along));
    } else if (vLayer < 1.5) {
      // ── Main Stem: Turbulent cold gas stream with frozen moisture ice sparkles ──
      float turb = slow.r, streak = fast.g;
      float body = smoothstep(0.0, 0.65, facing);
      float erode = smoothstep(0.12, 0.98, along);
      float clump = big.b * 0.6 + slow.r * 0.5;
      float keep = smoothstep(erode * 0.9 - 0.08, erode * 0.9 + 0.22, clump);
      alpha = body * keep * (0.4 + 0.6 * turb) * (0.72 + 0.28 * streak) * (1.0 - smoothstep(0.7, 1.0, along)) * 0.8;
      alpha += body * (1.0 - smoothstep(0.0, 0.2, along)) * 0.25;

      // Frozen moisture sparkles momentarily near nozzle exit
      float sparkle = step(0.988, plumeHash(floor(vec2(around * 64.0, vAlong * 40.0 - uTime * 30.0) + uSeed))) * (1.0 - along);
      color = uLight * shade * (0.86 + 0.24 * streak) + vec3(sparkle * 1.3);
      alpha = max(alpha, sparkle * body * 0.85);
    } else {
      // ── Mixing Layer: Expanding billowy shear vapor ──
      float body = smoothstep(0.0, 0.55, facing);
      float billow = smoothstep(0.25, 0.85, slow.b * 0.7 + big.r * 0.5) * (0.55 + 0.45 * fast.r);
      alpha = body * smoothstep(0.04, 0.3, along) * (1.0 - smoothstep(0.45, 1.0, along)) * billow * 0.38;
      color = uLight * shade * (0.84 + 0.14 * slow.r);
    }
    alpha *= uLevel * smoothstep(0.0, 0.03, along);
    if (alpha < 0.004) discard;
    gl_FragColor = vec4(color, min(alpha, 0.95));
  }
`;

// ── 2. Procedural Noise Texture (Ported from D1() in Roadster Dash) ──
let cachedNoise: THREE.DataTexture | null = null;
function getPlumeNoiseTexture(): THREE.DataTexture {
  if (cachedNoise) return cachedNoise;
  const size = 128;
  const data = new Uint8Array(size * size * 4);

  const makeGrid = (res: number, seed: number) => {
    const grid = new Float32Array(res * res);
    let s = seed;
    for (let i = 0; i < grid.length; i++) {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
      grid[i] = s / 4294967296;
    }
    return (x: number, y: number) => {
      const u = Math.floor(x), d = Math.floor(y);
      const fx = x - u, fy = y - d;
      const vx = fx * fx * (3 - 2 * fx), vy = fy * fy * (3 - 2 * fy);
      const getP = (px: number, py: number) => grid[((py % res + res) % res) * res + ((px % res + res) % res)]!;
      return (getP(u, d) * (1 - vx) + getP(u + 1, d) * vx) * (1 - vy) +
             (getP(u, d + 1) * (1 - vx) + getP(u + 1, d + 1) * vx) * vy;
    };
  };

  const octaves = [4, 8, 16, 32].map((res, i) => ({
    res,
    sampler: makeGrid(res, 20973 + i * 7919),
  }));
  const fine = [makeGrid(16, 40503), makeGrid(32, 32586)];

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const nx = x / size, ny = y / size;
      let c = 0, amp = 0.55, u = 0;
      for (const { res, sampler } of octaves) {
        const val = sampler(nx * res, ny * res);
        c += val * amp;
        u += Math.abs(val * 2 - 1) * amp;
        amp *= 0.5;
      }
      const d = fine[0]!(nx * 16, ny * 4) * 0.65 + fine[1]!(nx * 32, ny * 8) * 0.35;
      const idx = (y * size + x) * 4;
      data[idx]     = Math.min(255, Math.max(0, (c - 0.1) * 340));
      data[idx + 1] = Math.min(255, Math.max(0, d * 255));
      data[idx + 2] = Math.min(255, Math.max(0, (1 - u) * 300 - 20));
      data[idx + 3] = 255;
    }
  }

  cachedNoise = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  cachedNoise.wrapS = THREE.RepeatWrapping;
  cachedNoise.wrapT = THREE.RepeatWrapping;
  cachedNoise.magFilter = THREE.LinearFilter;
  cachedNoise.minFilter = THREE.LinearMipmapLinearFilter;
  cachedNoise.generateMipmaps = true;
  cachedNoise.needsUpdate = true;
  return cachedNoise;
}

// ── 3. Multi-layer Open Plume Geometry (Ported from zR() in Roadster Dash) ──
let cachedPlumeGeo: THREE.BufferGeometry | null = null;
function getPlumeGeometry(): THREE.BufferGeometry {
  if (cachedPlumeGeo) return cachedPlumeGeo;

  const createLayer = (rBottom: number, rTop: number, height: number, layerId: number, radialSegs: number) => {
    const geo = new THREE.CylinderGeometry(rTop, rBottom, height, 24, radialSegs, true);
    geo.translate(0, height / 2, 0);
    const count = geo.attributes.position!.count;
    geo.setAttribute('aLayer', new THREE.BufferAttribute(new Float32Array(count).fill(layerId), 1));
    return geo;
  };

  const l2 = createLayer(0.24, 1.25, 1.25, 2, 22);
  const l1 = createLayer(0.14, 0.82, 1.00, 1, 22);
  const l0 = createLayer(0.08, 0.36, 0.42, 0, 6);

  cachedPlumeGeo = BufferGeometryUtils.mergeGeometries([l2, l1, l0]);
  return cachedPlumeGeo;
}

// ── 4. Nozzle Flare Texture (Ported from GR() in Roadster Dash) ──
let cachedFlareTexture: THREE.CanvasTexture | null = null;
function getFlareTexture(): THREE.CanvasTexture {
  if (cachedFlareTexture) return cachedFlareTexture;
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createRadialGradient(32, 32, 1, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
  grad.addColorStop(0.25, 'rgba(220, 240, 255, 0.55)');
  grad.addColorStop(1, 'rgba(200, 230, 255, 0.0)');

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 64);

  cachedFlareTexture = new THREE.CanvasTexture(canvas);
  cachedFlareTexture.generateMipmaps = true;
  return cachedFlareTexture;
}

export interface ThrusterNozzle {
  id: ThrusterId;
  mesh: THREE.Mesh;
  flare: THREE.Sprite;
  material: THREE.ShaderMaterial;
  config: PlumeConfig;
  targetLevel: number;
  currentLevel: number;
  decayRate: number;
  direction: THREE.Vector3;
}

export class ColdGasThrusters {
  public readonly group: THREE.Group;
  private readonly nozzles = new Map<ThrusterId, ThrusterNozzle>();
  private readonly sharedTime = { value: 0 };
  private readonly sharedSun = { value: new THREE.Vector3(-0.4, 0.5, -0.8).normalize() };
  private readonly sharedWind = { value: new THREE.Vector3(0, 0, 0.6) };
  private readonly sharedLight = { value: new THREE.Color(1.1, 1.08, 1.05) };

  // Side jet hold state for lane shifts
  private sideJetTimer = 0;
  private activeSideId: ThrusterId | null = null;

  constructor() {
    this.group = new THREE.Group();

    // ── Build all 10 cold-gas thruster nozzles ──
    const noiseTex = getPlumeNoiseTexture();
    const plumeGeo = getPlumeGeometry();
    const flareTex = getFlareTexture();

    // Nozzle physical placement on player car chassis:
    // Model length ~ 4.2m (rear at z = 2.05), width ~ 1.9m, height ~ 1.1m
    const nozzlePositions: Record<ThrusterId, { pos: THREE.Vector3; dir: THREE.Vector3 }> = {
      // 4 Rear nozzles: cluster behind diffuser / rear license plate
      R1: { pos: new THREE.Vector3(-0.39, 0.475, 2.26), dir: new THREE.Vector3(0, 0, 1) },
      R2: { pos: new THREE.Vector3(-0.13, 0.475, 2.26), dir: new THREE.Vector3(0, 0, 1) },
      R3: { pos: new THREE.Vector3( 0.13, 0.475, 2.26), dir: new THREE.Vector3(0, 0, 1) },
      R4: { pos: new THREE.Vector3( 0.39, 0.475, 2.26), dir: new THREE.Vector3(0, 0, 1) },

      // 4 Lift nozzles: pointing straight DOWN under floor pan
      L1: { pos: new THREE.Vector3(-0.58, 0.07, -1.82), dir: new THREE.Vector3(0, -1, 0) }, // Front Left
      L2: { pos: new THREE.Vector3( 0.58, 0.07, -1.82), dir: new THREE.Vector3(0, -1, 0) }, // Front Right
      L3: { pos: new THREE.Vector3(-0.79, 0.05,  2.16), dir: new THREE.Vector3(0, -1, 0) }, // Rear Left
      L4: { pos: new THREE.Vector3( 0.79, 0.05,  2.16), dir: new THREE.Vector3(0, -1, 0) }, // Rear Right

      // 2 Side nozzles: on outer vehicle flanks
      S1: { pos: new THREE.Vector3(-0.96, 0.42, -0.25), dir: new THREE.Vector3(-1, 0, 0) }, // Left flank (points left)
      S2: { pos: new THREE.Vector3( 0.96, 0.42, -0.25), dir: new THREE.Vector3( 1, 0, 0) }, // Right flank (points right)
    };

    for (const id of ALL_THRUSTER_IDS) {
      const type = id[0]!;
      const cfg = PLUME_CONFIGS[type] ?? PLUME_CONFIGS.R!;
      const { pos, dir } = nozzlePositions[id];

      const seed = id.charCodeAt(0) * 0.37 + Number(id.slice(1)) * 0.191;

      const mat = new THREE.ShaderMaterial({
        vertexShader: FR,
        fragmentShader: BR,
        uniforms: {
          uLevel:  { value: 0 },
          uSpread: { value: cfg.spread },
          uTime:   this.sharedTime,
          uLight:  this.sharedLight,
          uSun:    this.sharedSun,
          uWind:   this.sharedWind,
          uNoise:  { value: noiseTex },
          uSeed:   { value: seed },
        },
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      });

      const mesh = new THREE.Mesh(plumeGeo, mat);
      mesh.name = `Thruster plume ${id}`;
      mesh.position.copy(pos);
      mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
      mesh.scale.set(cfg.width, cfg.len, cfg.width);
      mesh.visible = false;
      mesh.renderOrder = 9;
      mesh.frustumCulled = false;

      // Aperture flare sprite
      const flareMat = new THREE.SpriteMaterial({
        map: flareTex,
        color: 0xffffff,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        opacity: 0,
      });
      const flare = new THREE.Sprite(flareMat);
      flare.position.set(0, 0.05, 0);
      flare.renderOrder = 10;
      mesh.add(flare);

      this.group.add(mesh);

      this.nozzles.set(id, {
        id,
        mesh,
        flare,
        material: mat,
        config: cfg,
        targetLevel: 0,
        currentLevel: 0,
        decayRate: 8.0,
        direction: dir,
      });
    }
  }

  /** Fire specified nozzles at a target level (0..1) */
  public fire(ids: ThrusterId[], level = 1.0, decayRate = 8.0): void {
    const l = Math.min(1.0, Math.max(0.0, level));
    for (const id of ids) {
      const n = this.nozzles.get(id);
      if (n) {
        n.targetLevel = Math.max(n.targetLevel, l);
        n.currentLevel = Math.max(n.currentLevel, l);
        n.decayRate = decayRate;
      }
    }
  }

  /** Fire side thruster for lane shift duration */
  public sideJet(id: 'S1' | 'S2', duration = 0.14): void {
    this.activeSideId = id;
    this.sideJetTimer = duration;
    this.fire([id], 1.0, 5.0);
  }

  /** Continuous firing for hover or boost */
  public fireContinuous(ids: ThrusterId[], level = 1.0): void {
    for (const id of ids) {
      const n = this.nozzles.get(id);
      if (n) {
        n.targetLevel = level;
        n.currentLevel = level;
      }
    }
  }

  /** Update all thruster plumes, wind vectors, and flare sizes */
  public update(dt: number, speed = 1.0): void {
    this.sharedTime.value += dt;

    // Dynamic wind resistance: faster driving bends plumes further backward
    this.sharedWind.value.z = 0.5 + Math.min(1.5, speed * 0.03);

    // Side jet duration hold
    if (this.activeSideId && this.sideJetTimer > 0) {
      this.sideJetTimer -= dt;
      const n = this.nozzles.get(this.activeSideId);
      if (n) {
        n.currentLevel = Math.max(n.currentLevel, 1.0);
      }
      if (this.sideJetTimer <= 0) {
        this.activeSideId = null;
      }
    }

    for (const [, n] of this.nozzles) {
      // Exponential level decay
      n.currentLevel = Math.max(0, n.currentLevel - n.decayRate * dt);
      n.targetLevel = 0; // Reset target for next frame

      const lvl = n.currentLevel;
      n.material.uniforms.uLevel!.value = lvl;
      n.mesh.visible = lvl > 0.02;

      if (n.mesh.visible) {
        const cfg = n.config;
        const width = cfg.width * (0.85 + 0.15 * lvl);
        const length = cfg.len * (0.4 + 0.6 * lvl);
        n.mesh.scale.set(width, length, width);

        // Aperture flare scaling
        n.flare.scale.set((0.45 * lvl) / width, (0.45 * lvl) / length, 1);
        n.flare.material.opacity = 0.85 * lvl;
      }
    }
  }

  /** Get active glow level (0..1) for a specific nozzle to drive vehicle aperture lighting */
  public getNozzleLevel(id: ThrusterId): number {
    return this.nozzles.get(id)?.currentLevel ?? 0;
  }

  /** Reset all thrusters to idle */
  public reset(): void {
    this.activeSideId = null;
    this.sideJetTimer = 0;
    for (const [, n] of this.nozzles) {
      n.currentLevel = 0;
      n.targetLevel = 0;
      n.material.uniforms.uLevel!.value = 0;
      n.mesh.visible = false;
      n.flare.material.opacity = 0;
    }
  }
}
