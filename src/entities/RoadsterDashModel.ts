/**
 * RoadsterDashModel.ts — Direct extraction and port of the authentic procedural
 * Tesla Roadster 3D car model from Roadster Dash (https://roadsterdash.com).
 *
 * Implements:
 * - 14-station Catmull-Rom cross-sectional spline hull lofting
 * - Dual front/rear carved wheel arch geometry
 * - 9-part segmented body with pearlescent automotive coat and smoked canopy
 * - Signature continuous LED taillight bar and curved front headlight blades
 * - Carbon aerodynamic chin splitter, rear diffuser venturi tunnels with rotating fans
 * - 3-piece deployable active aero rear wing with carbon mounting struts
 * - 6-spoke turbine performance rims, radial tires, and disc brakes
 */
import * as THREE from 'three';

// ── Physical Roadster Dimensions & Key Stations ──
const WHEEL_RADIUS = 0.34;
const TIRE_WIDTH = 0.3;
const TRACK_HALF_WIDTH = 0.86;
const FRONT_AXLE_Z = -1.05;
const REAR_AXLE_Z = 1.7;
const ARCH_RADIUS = 0.41;
const NOSE_CHIN_Z = -1.35;
const COCKPIT_FRONT_Z = -0.62;
const DOOR_SEAM_Z = [0.49, 0.52] as const;
const B_PILLAR_Z = 0.6;
const REAR_GLASS_Z = 1.1;
const TAIL_DECK_Z = 1.9;

export interface SliceStation {
  z: number;
  yb: number;
  wl: number;
  wb: number;
  yB: number;
  ws: number;
  ys: number;
  wp?: number;
  yp?: number;
  wr?: number;
  yr?: number;
  wt: number;
  yt: number;
}

const HULL_SLICES: SliceStation[] = [
  { z: -2.2,  yb: 0.15, wl: 0.64, wb: 0.665, yB: 0.27, ws: 0.62,  ys: 0.44, wt: 0.60, yt: 0.47 },
  { z: -2.05, yb: 0.15, wl: 0.76, wb: 0.800, yB: 0.29, ws: 0.79,  ys: 0.46, wt: 0.60, yt: 0.53 },
  { z: -1.85, yb: 0.15, wl: 0.86, wb: 0.900, yB: 0.32, ws: 0.92,  ys: 0.52, wt: 0.58, yt: 0.61 },
  { z: -1.6,  yb: 0.15, wl: 0.89, wb: 0.950, yB: 0.35, ws: 0.98,  ys: 0.60, wt: 0.54, yt: 0.70 },
  { z: NOSE_CHIN_Z, yb: 0.13, wl: 0.90, wb: 0.970, yB: 0.38, ws: 0.995, ys: 0.72, wt: 0.50, yt: 0.79 },
  { z: -1.0,  yb: 0.13, wl: 0.90, wb: 0.975, yB: 0.36, ws: 0.99,  ys: 0.82, wp: 0.60, yp: 0.87,  wr: 0.57, yr: 0.88,  wt: 0.46, yt: 0.89 },
  { z: -0.6,  yb: 0.13, wl: 0.90, wb: 0.990, yB: 0.31, ws: 0.87,  ys: 0.86, wp: 0.68, yp: 0.97,  wr: 0.64, yr: 0.985, wt: 0.42, yt: 0.995 },
  { z: -0.2,  yb: 0.13, wl: 0.90, wb: 0.990, yB: 0.32, ws: 0.90,  ys: 0.84, wp: 0.66, yp: 1.14,  wr: 0.62, yr: 1.155, wt: 0.40, yt: 1.168 },
  { z:  0.3,  yb: 0.13, wl: 0.90, wb: 0.990, yB: 0.34, ws: 0.91,  ys: 0.86, wp: 0.64, yp: 1.155, wr: 0.60, yr: 1.165, wt: 0.38, yt: 1.175 },
  { z: B_PILLAR_Z, yb: 0.13, wl: 0.91, wb: 1.000, yB: 0.36, ws: 0.92, ys: 0.89, wp: 0.60, yp: 1.135, wr: 0.56, yr: 1.15,  wt: 0.35, yt: 1.155 },
  { z: REAR_GLASS_Z, yb: 0.13, wl: 0.92, wb: 1.000, yB: 0.41, ws: 0.95, ys: 0.89, wp: 0.53, yp: 1.07,  wr: 0.48, yr: 1.08,  wt: 0.32, yt: 1.02 },
  { z: REAR_AXLE_Z, yb: 0.14, wl: 0.92, wb: 1.000, yB: 0.46, ws: 0.97, ys: 0.90, wp: 0.45, yp: 0.975, wr: 0.40, yr: 0.98,  wt: 0.29, yt: 0.925 },
  { z:  2.0,  yb: 0.16, wl: 0.89, wb: 0.970, yB: 0.53, ws: 0.96,  ys: 0.90, wp: 0.40, yp: 0.935, wr: 0.36, yr: 0.94,  wt: 0.28, yt: 0.91 },
  { z:  2.22, yb: 0.16, wl: 0.85, wb: 0.930, yB: 0.58, ws: 0.94,  ys: 0.90, wp: 0.38, yp: 0.925, wr: 0.34, yr: 0.925, wt: 0.28, yt: 0.92 },
];

for (const s of HULL_SLICES) {
  s.wp ??= s.wt;
  s.yp ??= s.yt;
  s.wr ??= s.wt;
  s.yr ??= s.yt;
}

const SPLINE_KEYS = ['yb', 'wl', 'wb', 'yB', 'ws', 'ys', 'wp', 'yp', 'wr', 'yr', 'wt', 'yt'] as const;
const REAR_TRANSOM_Y = 0.55;
const REAR_TRANSOM_W = 0.66;

function catmullRom(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const t2 = t * t;
  const t3 = t2 * t;
  return 0.5 * (
    2 * p1 +
    (-p0 + p2) * t +
    (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
    (-p0 + 3 * p1 - 3 * p2 + p3) * t3
  );
}

function evaluateSliceAtZ(z: number): Record<string, number> {
  let idx = 0;
  for (; idx < HULL_SLICES.length - 2 && z > HULL_SLICES[idx + 1].z;) idx++;
  const s0 = HULL_SLICES[Math.max(0, idx - 1)];
  const s1 = HULL_SLICES[idx];
  const s2 = HULL_SLICES[idx + 1];
  const s3 = HULL_SLICES[Math.min(HULL_SLICES.length - 1, idx + 2)];
  const t = THREE.MathUtils.clamp((z - s1.z) / (s2.z - s1.z), 0, 1);

  const res: Record<string, number> = { z };
  for (const k of SPLINE_KEYS) {
    res[k] = catmullRom(s0[k]!, s1[k]!, s2[k]!, s3[k]!, t);
  }
  if (z <= NOSE_CHIN_Z) {
    res.wp = res.wr = res.wt;
    res.yp = res.yr = res.yt;
  }
  const blend = THREE.MathUtils.smoothstep(z, B_PILLAR_Z, REAR_GLASS_Z);
  res.wg = THREE.MathUtils.lerp(res.ws, res.wp, blend);
  res.yg = THREE.MathUtils.lerp(res.ys, res.yp, blend);
  res.yq = res.yb;

  // Wheel arch clearances
  for (const axleZ of [FRONT_AXLE_Z, REAR_AXLE_Z]) {
    const dz = z - axleZ;
    if (Math.abs(dz) < ARCH_RADIUS) {
      const archTop = WHEEL_RADIUS + Math.sqrt(ARCH_RADIUS * ARCH_RADIUS - dz * dz) + 0.02;
      res.yb = Math.max(res.yb, archTop);
      res.yB = Math.max(res.yB, archTop + 0.015);
    }
  }
  return res;
}

const INNER_WELL_X = TRACK_HALF_WIDTH - TIRE_WIDTH / 2 - 0.01;
const CONTOUR_POINT_NAMES = { Q1: 0, Q2: 1, P0: 2, P1: 3, P2: 4, G: 5, P3: 6, R: 7, P4: 8 } as const;
const VERTS_PER_SLICE = 18;

function getContourPoints(slice: Record<string, number>): [number, number][] {
  const half: [number, number][] = [
    [INNER_WELL_X, slice.yq],
    [INNER_WELL_X, slice.yb],
    [slice.wl, slice.yb],
    [slice.wb, slice.yB],
    [slice.ws, slice.ys],
    [slice.wg, slice.yg],
    [slice.wp, slice.yp],
    [slice.wr, slice.yr],
    [slice.wt, slice.yt],
  ];
  return [...half, ...half.map(([x, y]) => [-x, y] as [number, number]).reverse()];
}

function sampleBodyCurve(z: number, ptA: keyof typeof CONTOUR_POINT_NAMES, ptB: keyof typeof CONTOUR_POINT_NAMES, t: number, offset = 0.006) {
  const contour = getContourPoints(evaluateSliceAtZ(z));
  const [ax, ay] = contour[CONTOUR_POINT_NAMES[ptA]];
  const [bx, by] = contour[CONTOUR_POINT_NAMES[ptB]];
  const len = Math.hypot(bx - ax, by - ay) || 1;
  const nx = (by - ay) / len;
  const ny = -(bx - ax) / len;
  return {
    x: ax + (bx - ax) * t + nx * offset,
    y: ay + (by - ay) * t + ny * offset,
    angle: Math.atan2(by - ay, bx - ax)
  };
}

function generateZStationList(): number[] {
  const set = new Set<number>();
  for (let z = -2.2; z <= 2.2201; z += 0.05) set.add(+z.toFixed(3));
  for (const axleZ of [FRONT_AXLE_Z, REAR_AXLE_Z]) {
    for (let dt = -ARCH_RADIUS - 0.02; dt <= ARCH_RADIUS + 0.02; dt += 0.035) set.add(+(axleZ + dt).toFixed(3));
    set.add(+(axleZ - ARCH_RADIUS).toFixed(3));
    set.add(+(axleZ + ARCH_RADIUS).toFixed(3));
  }
  for (const s of HULL_SLICES) set.add(s.z);
  for (const z of DOOR_SEAM_Z) set.add(z);
  for (let z = B_PILLAR_Z; z < REAR_GLASS_Z; z += 0.025) set.add(+z.toFixed(3));
  return [...set].filter(z => z >= -2.2 && z <= 2.22).sort((a, b) => a - b);
}

class TriangleBuffer {
  public pos: number[] = [];
  public nrm: number[] = [];

  public tri(
    p0: number[], p1: number[], p2: number[],
    n0: number[], n1: number[], n2: number[]
  ) {
    this.pos.push(...p0, ...p1, ...p2);
    this.nrm.push(...n0, ...n1, ...n2);
  }

  public toGeometry(): THREE.BufferGeometry {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(this.nrm, 3));
    return geo;
  }
}

type MaterialSlot = 'body' | 'glass' | 'lower' | 'cavity';

function getMaterialSlot(vertIdx: number, z: number): MaterialSlot {
  const half = vertIdx < VERTS_PER_SLICE / 2 ? vertIdx : VERTS_PER_SLICE - 2 - vertIdx;
  if (half < CONTOUR_POINT_NAMES.P0) return 'cavity';
  if (half <= CONTOUR_POINT_NAMES.P0) return 'lower';
  const inCockpit = z > NOSE_CHIN_Z;
  if (half === CONTOUR_POINT_NAMES.G) {
    if (!inCockpit || z < COCKPIT_FRONT_Z || z >= REAR_GLASS_Z) return 'body';
    if (z > DOOR_SEAM_Z[0] && z < DOOR_SEAM_Z[1]) return 'lower';
    return 'glass';
  }
  if ((half === CONTOUR_POINT_NAMES.R || half === CONTOUR_POINT_NAMES.P4) && inCockpit && z < TAIL_DECK_Z) {
    return 'glass';
  }
  return 'body';
}

function clipPolygon(pts: [number, number][], axis: 0 | 1, val: number, keepLower: boolean): [number, number][] {
  const check = (p: [number, number]) => keepLower ? p[axis] <= val : p[axis] >= val;
  const out: [number, number][] = [];
  for (let i = 0; i < pts.length; i++) {
    const cur = pts[i];
    const nxt = pts[(i + 1) % pts.length];
    if (check(cur)) out.push(cur);
    if (check(cur) !== check(nxt)) {
      const frac = (val - cur[axis]) / (nxt[axis] - cur[axis]);
      out.push([cur[0] + (nxt[0] - cur[0]) * frac, cur[1] + (nxt[1] - cur[1]) * frac]);
    }
  }
  return out;
}

function createEndcapMesh(pts: [number, number][], material: THREE.Material, z: number, invert = false): THREE.Mesh {
  const filtered = pts.filter((p, i, a) => i === 0 || Math.hypot(p[0] - a[i - 1][0], p[1] - a[i - 1][1]) > 1e-5);
  const shape = new THREE.Shape(filtered.map(([x, y]) => new THREE.Vector2(invert ? -x : x, y)));
  const geo = new THREE.ShapeGeometry(shape);
  if (invert) geo.rotateY(Math.PI);
  return new THREE.Mesh(geo.translate(0, 0, z), material);
}

function createBoxMesh(w: number, h: number, d: number, mat: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.position.set(x, y, z);
  return mesh;
}

function createBrakeCaliperGeometry(): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(-0.022, 0.05);
  shape.lineTo(0.022, 0.05);
  shape.lineTo(0.064, 0.252);
  shape.lineTo(-0.016, 0.252);
  shape.closePath();
  const depth = 0.026;
  return new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false })
    .translate(0, 0, -depth / 2)
    .rotateY(Math.PI / 2);
}

function createWheelAssembly(
  materials: Record<string, THREE.Material>,
  sideSign: number,
  caliperGeo: THREE.BufferGeometry
) {
  const wheel = new THREE.Group();
  const spin = new THREE.Group();
  wheel.add(spin);

  // Tire
  const tireMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(WHEEL_RADIUS, WHEEL_RADIUS, TIRE_WIDTH, 28, 1),
    materials.tire
  );
  tireMesh.rotation.z = Math.PI / 2;
  spin.add(tireMesh);

  // Rim assembly
  const rimGroup = new THREE.Group();
  rimGroup.position.x = sideSign * (TIRE_WIDTH / 2 + 0.002);
  spin.add(rimGroup);

  // Outer aero dish
  const discMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.25, 0.25, 0.012, 36),
    materials.wheelInsert
  );
  discMesh.rotation.z = Math.PI / 2;
  rimGroup.add(discMesh);

  // Outer rim lip
  const lipMesh = new THREE.Mesh(
    new THREE.TorusGeometry(0.258, 0.02, 6, 32),
    materials.wheelSpoke
  );
  lipMesh.rotation.y = Math.PI / 2;
  rimGroup.add(lipMesh);

  // 6 machined alloy turbine spokes
  for (let s = 0; s < 6; s++) {
    const spoke = new THREE.Mesh(caliperGeo, materials.wheelSpoke);
    spoke.position.x = sideSign * 0.004;
    spoke.rotation.x = (s / 6) * Math.PI * 2;
    rimGroup.add(spoke);
  }

  // Center hub cap
  const centerCap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.055, 0.062, 0.036, 20),
    materials.wheelSpoke
  );
  centerCap.rotation.z = Math.PI / 2;
  centerCap.position.x = sideSign * 0.01;
  rimGroup.add(centerCap);

  // Caliper accent block
  rimGroup.add(createBoxMesh(0.006, 0.01, 0.034, materials.wheelInsert, sideSign * 0.029, 0, 0));

  return { wheel, spin, tire: tireMesh };
}

function createDiffuserFan(materials: Record<string, THREE.Material>, bladeGeo: THREE.BoxGeometry) {
  const fan = new THREE.Group();
  const housing = new THREE.Mesh(new THREE.CircleGeometry(0.1, 20), materials.cavity);
  housing.position.z = -0.03;
  fan.add(housing);

  const bezel = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.014, 6, 24), materials.carbon);
  fan.add(bezel);

  const rotor = new THREE.Group();
  const hub = new THREE.Mesh(new THREE.ConeGeometry(0.036, 0.08, 12), materials.wheelDark);
  hub.rotation.x = Math.PI / 2;
  hub.position.z = 0.02;
  rotor.add(hub);

  // 7 pitched turbine blades
  for (let b = 0; b < 7; b++) {
    const angle = (b / 7) * Math.PI * 2;
    const blade = new THREE.Mesh(bladeGeo, materials.fanBlade);
    blade.rotation.order = 'ZYX';
    blade.rotation.set(0.6, 0, angle);
    blade.position.set(Math.cos(angle) * 0.06, Math.sin(angle) * 0.06, -0.01);
    rotor.add(blade);
  }
  fan.add(rotor);
  return { fan, rotor, hub };
}

function createPlateTexture(text = 'RDSTR'): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#d9d9d6';
  ctx.fillRect(0, 0, 256, 128);
  ctx.strokeStyle = '#9a9a96';
  ctx.lineWidth = 6;
  ctx.strokeRect(6, 6, 244, 116);
  ctx.fillStyle = '#3b3b3b';
  ctx.font = 'bold 66px "Arial Narrow", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 128, 68);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function createTaillightGlowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(128, 32, 4, 128, 32, 120);
  grad.addColorStop(0, 'rgba(255, 30, 40, 1.0)');
  grad.addColorStop(0.35, 'rgba(255, 20, 30, 0.45)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0.0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 64);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export interface RoadsterDashCarInstance {
  group: THREE.Group;
  body: THREE.Group;
  wheels: { wheel: THREE.Group; spin: THREE.Group; front: boolean }[];
  frontWheels: THREE.Object3D[];
  materials: Record<string, THREE.Material>;
  setWing: (t: number) => void;
  getWingT: () => number;
  setTaillight: (intensity: number) => void;
  setNozzleGlow: (id: string, level: number) => void;
  setPlate: (text: string) => void;
  updateFans: (dt: number) => void;
}

/**
 * Creates the complete Roadster Dash player vehicle from game-B3y-p7Aj.js.
 */
export function createRoadsterDashCar(customColor = 0xeeefea, plateText = 'RDSTR'): RoadsterDashCarInstance {
  // ── 1. Create Authentic Automotive Materials from game-B3y-p7Aj.js ──
  const materials: Record<string, THREE.Material> = {
    body: new THREE.MeshPhysicalMaterial({
      color: customColor,
      roughness: 0.3,
      metalness: 0.05,
      clearcoat: 1.0,
      clearcoatRoughness: 0.07,
      envMapIntensity: 1.0,
    }),
    glass: new THREE.MeshPhysicalMaterial({
      color: 0x514538,
      roughness: 0.1,
      metalness: 0.72,
      envMapIntensity: 1.05,
      clearcoat: 1.0,
      clearcoatRoughness: 0.06,
    }),
    lower: new THREE.MeshStandardMaterial({
      color: 0x141414,
      roughness: 0.55,
      metalness: 0.2,
    }),
    carbon: new THREE.MeshStandardMaterial({
      color: 0x0f0f11,
      roughness: 0.36,
      metalness: 0.35,
    }),
    tire: new THREE.MeshStandardMaterial({
      color: 0x181818,
      roughness: 0.9,
    }),
    wheelDark: new THREE.MeshStandardMaterial({
      color: 0x1b1b1d,
      roughness: 0.35,
      metalness: 0.6,
    }),
    wheelSpoke: new THREE.MeshStandardMaterial({
      color: 0x0e0e10,
      roughness: 0.25,
      metalness: 0.6,
    }),
    wheelInsert: new THREE.MeshStandardMaterial({
      color: 0xbfbfbf,
      roughness: 0.45,
      metalness: 0.2,
    }),
    gold: new THREE.MeshStandardMaterial({
      color: 0xb8925a,
      roughness: 0.25,
      metalness: 1.0,
    }),
    taillight: new THREE.MeshStandardMaterial({
      color: 0x330000,
      emissive: 0xff0404,
      emissiveIntensity: 2.4,
    }),
    piano: new THREE.MeshPhysicalMaterial({
      color: 0x050507,
      roughness: 0.12,
      metalness: 0.1,
      clearcoat: 1.0,
      clearcoatRoughness: 0.08,
    }),
    chin: new THREE.MeshStandardMaterial({
      color: 0xa4a8ad,
      roughness: 0.38,
      metalness: 0.45,
    }),
    headlight: new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xe8f2ff,
      emissiveIntensity: 4.0,
    }),
    wing: new THREE.MeshPhysicalMaterial({
      color: customColor,
      roughness: 0.32,
      metalness: 0.2,
      clearcoat: 0.6,
      clearcoatRoughness: 0.18,
    }),
    cavity: new THREE.MeshStandardMaterial({
      color: 0x050506,
      roughness: 0.9,
    }),
    fanBlade: new THREE.MeshStandardMaterial({
      color: 0x4a4540,
      roughness: 0.45,
      metalness: 0.6,
    }),
  };

  const rootGroup = new THREE.Group();
  const bodyGroup = new THREE.Group();
  rootGroup.add(bodyGroup);

  // ── 2. Sweep Cross Sections to Construct Hull Geometry ──
  const zStations = generateZStationList();
  const slicesData = zStations.map(z => ({ z, pts: getContourPoints(evaluateSliceAtZ(z)) }));

  const buffers: Record<MaterialSlot, TriangleBuffer> = {
    body: new TriangleBuffer(),
    glass: new TriangleBuffer(),
    lower: new TriangleBuffer(),
    cavity: new TriangleBuffer(),
  };

  const quadRings: [THREE.Vector3, THREE.Vector3][][] = [];
  const normalRings: THREE.Vector3[][] = [];

  for (let f = 0; f < VERTS_PER_SLICE; f++) {
    const p = f;
    const v = (f + 1) % VERTS_PER_SLICE;
    const ring = slicesData.map(s => [
      new THREE.Vector3(s.pts[p][0], s.pts[p][1], s.z),
      new THREE.Vector3(s.pts[v][0], s.pts[v][1], s.z),
    ] as [THREE.Vector3, THREE.Vector3]);

    const segNormals: (THREE.Vector3 | null)[] = [];
    for (let y = 0; y < ring.length - 1; y++) {
      const [x0, x1] = ring[y];
      const [p0, p1] = ring[y + 1];
      const norm = new THREE.Vector3()
        .subVectors(p1, x0)
        .cross(new THREE.Vector3().subVectors(p0, x1));
      segNormals.push(norm.lengthSq() > 1e-12 ? norm.normalize() : null);
    }

    normalRings.push(ring.map((_, y) => {
      const acc = new THREE.Vector3();
      for (const n of [segNormals[y - 1], segNormals[y]]) {
        if (n) acc.add(n);
      }
      for (let step = 1; acc.lengthSq() < 1e-12 && step < segNormals.length; step++) {
        const fallback = segNormals[y - 1 - step] || segNormals[y + step];
        if (fallback) acc.copy(fallback);
      }
      if (acc.lengthSq() < 1e-12) acc.set(0, 1, 0);
      return acc.normalize();
    }));

    quadRings.push(ring);
  }

  const creaseCos = Math.cos(THREE.MathUtils.degToRad(38));
  const calcNormal = (f: number, neighbor: number, ringIdx: number, z: number) => {
    const curN = normalRings[f][ringIdx];
    const nbrN = normalRings[neighbor][ringIdx];
    if (z < NOSE_CHIN_Z + 0.2 || getMaterialSlot(f, z) !== getMaterialSlot(neighbor, z) || curN.dot(nbrN) < creaseCos) {
      return curN.toArray();
    }
    return curN.clone().add(nbrN).normalize().toArray();
  };

  for (let f = 0; f < VERTS_PER_SLICE; f++) {
    const quad = quadRings[f];
    const prev = (f - 1 + VERTS_PER_SLICE) % VERTS_PER_SLICE;
    const next = (f + 1) % VERTS_PER_SLICE;

    for (let m = 0; m < quad.length - 1; m++) {
      const midZ = (slicesData[m].z + slicesData[m + 1].z) / 2;
      const targetBuffer = buffers[getMaterialSlot(f, midZ)];

      const p0 = quad[m][0].toArray();
      const p1 = quad[m][1].toArray();
      const p2 = quad[m + 1][0].toArray();
      const p3 = quad[m + 1][1].toArray();

      const n0 = calcNormal(f, prev, m, midZ);
      const n1 = calcNormal(f, next, m, midZ);
      const n2 = calcNormal(f, prev, m + 1, midZ);
      const n3 = calcNormal(f, next, m + 1, midZ);

      targetBuffer.tri(p0, p1, p2, n0, n1, n2);
      targetBuffer.tri(p1, p3, p2, n1, n3, n2);
    }
  }

  for (const [slot, buf] of Object.entries(buffers)) {
    const mesh = new THREE.Mesh(buf.toGeometry(), materials[slot]);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    bodyGroup.add(mesh);
  }

  // Endcaps (Nose grille and Rear deck)
  const frontSlice = slicesData[0];
  bodyGroup.add(createEndcapMesh(clipPolygon(frontSlice.pts, 1, 0.29, false), materials.piano, frontSlice.z, true));
  bodyGroup.add(createEndcapMesh(clipPolygon(frontSlice.pts, 1, 0.29, true), materials.lower, frontSlice.z, true));

  const rearSlice = slicesData[slicesData.length - 1];
  bodyGroup.add(createEndcapMesh(clipPolygon(rearSlice.pts, 1, REAR_TRANSOM_Y, false), materials.body, rearSlice.z));
  const rearLowerHalf = rearSlice.pts.slice(0, VERTS_PER_SLICE / 2);
  const rearLowerPoly = clipPolygon([[REAR_TRANSOM_W, rearLowerHalf[0][1]], ...rearLowerHalf, [REAR_TRANSOM_W, 2]], 1, REAR_TRANSOM_Y, true);
  bodyGroup.add(createEndcapMesh(rearLowerPoly, materials.lower, rearSlice.z));
  bodyGroup.add(createEndcapMesh(rearLowerPoly.map(([x, y]) => [-x, y] as [number, number]).reverse(), materials.lower, rearSlice.z));

  // ── 3. Front Fascia Details (LED Headlight Blades & Carbon Splitter) ──
  bodyGroup.add(createBoxMesh(1.18, 0.014, 0.02, materials.headlight, 0, 0.458, -2.208));
  bodyGroup.add(createBoxMesh(1.26, 0.022, 0.07, materials.chin, 0, 0.148, -2.19));

  for (const side of [-1, 1]) {
    const segments = Array.from({ length: 6 }, (_, idx) => {
      const frac = idx / 5;
      const z = -2.005 + frac * 0.14;
      const pt = sampleBodyCurve(z, 'G', 'P3', 0.8 - frac * 0.52, 0.008);
      return new THREE.Vector3(side * pt.x, pt.y, z);
    });

    const startPt = segments[0];
    const endPt = segments[segments.length - 1];
    const quat = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(1, 0, 0),
      endPt.clone().sub(startPt).normalize()
    );

    for (const seg of segments) {
      const ledBlock = createBoxMesh(0.03, 0.02, 0.014, materials.headlight, seg.x, seg.y, seg.z);
      ledBlock.quaternion.copy(quat);
      bodyGroup.add(ledBlock);
    }

    const eyebrow = createBoxMesh(startPt.distanceTo(endPt) + 0.03, 0.008, 0.01, materials.headlight, 0, 0, 0);
    eyebrow.position.copy(startPt).add(endPt).multiplyScalar(0.5);
    eyebrow.quaternion.copy(quat);
    bodyGroup.add(eyebrow);
  }

  // Side quarter vents and aerodynamic character creases
  for (const side of [-1, 1]) {
    for (const [zPos, mat, ptA, ptB] of [
      [-0.55, materials.cavity, 'P1', 'P2'],
      [2.16, materials.taillight, 'P0', 'P1'],
    ] as const) {
      const pt = sampleBodyCurve(zPos, ptA, ptB, 0.6, 0.004);
      const vent = createBoxMesh(0.012, 0.03, 0.1, mat, side * pt.x, pt.y, zPos);
      vent.rotation.z = side * (pt.angle - Math.PI / 2);
      bodyGroup.add(vent);
    }
  }

  for (const side of [-1, 1]) {
    const curvePoints: THREE.Vector3[] = [];
    for (let i = 0; i <= 8; i++) {
      const frac = i / 8;
      const zPos = 0.78 + 0.09 * frac;
      const pt = sampleBodyCurve(zPos, 'P1', 'P2', 0.08 + frac * 0.88, 0.002);
      curvePoints.push(new THREE.Vector3(side * pt.x, pt.y, zPos));
    }
    bodyGroup.add(new THREE.Mesh(
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3(curvePoints), 8, 0.0025, 4, false),
      materials.cavity
    ));
  }

  // ── 4. Rear Fascia Details (Continuous Lightblade, Halo Glow, Plate & Diffuser) ──
  bodyGroup.add(createBoxMesh(1.9, 0.02, 0.05, materials.body, 0, 0.908, 2.225));
  bodyGroup.add(createBoxMesh(1.88, 0.063, 0.02, materials.carbon, 0, 0.8665, 2.224));
  bodyGroup.add(createBoxMesh(1.6, 0.008, 0.012, materials.taillight, 0, 0.886, 2.232));
  bodyGroup.add(createBoxMesh(1.84, 0.024, 0.024, materials.taillight, 0, 0.85, 2.234));

  for (const side of [-1, 1]) {
    const sideFin = createBoxMesh(0.022, 0.024, 0.18, materials.taillight, side * 0.935, 0.845, 2.15);
    sideFin.rotation.x = 0.12;
    bodyGroup.add(sideFin);
  }
  bodyGroup.add(createBoxMesh(1.86, 0.026, 0.08, materials.body, 0, 0.822, 2.24));

  // Taillight billboard bloom halo
  const taillightHaloMat = new THREE.MeshBasicMaterial({
    color: 0xff1b32,
    map: createTaillightGlowTexture(),
    transparent: true,
    opacity: 0.5,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
  const taillightHalo = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 0.28), taillightHaloMat);
  taillightHalo.position.set(0, 0.855, 2.28);
  bodyGroup.add(taillightHalo);

  // License plate bracket
  const plateBracketShape = new THREE.Shape([
    new THREE.Vector2(-0.36, 0.1),
    new THREE.Vector2(0.36, 0.1),
    new THREE.Vector2(0.24, -0.1),
    new THREE.Vector2(-0.24, -0.1),
  ]);
  const plateBracket = new THREE.Mesh(
    new THREE.ExtrudeGeometry(plateBracketShape, { depth: 0.03, bevelEnabled: false }),
    materials.body
  );
  plateBracket.position.set(0, 0.68, 2.21);
  bodyGroup.add(plateBracket);

  // License plate plane
  const plateMat = new THREE.MeshStandardMaterial({
    map: createPlateTexture(plateText),
    roughness: 0.5,
    metalness: 0.3,
  });
  const plateMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.15), plateMat);
  plateMesh.position.set(0, 0.675, 2.243);
  bodyGroup.add(plateMesh);

  // Backup camera
  bodyGroup.add(createBoxMesh(0.06, 0.018, 0.02, materials.carbon, 0, 0.772, 2.24));

  // Corner cavity slots
  for (const side of [-1, 1]) {
    bodyGroup.add(createBoxMesh(0.03, 0.1, 0.01, materials.cavity, side * 0.82, 0.67, 2.224));
  }

  // Diffuser venturi tunnels
  const diffuserZ = 2.25;
  const tunnelOuter = [
    [-REAR_TRANSOM_W, 0.14], [-0.58, 0.06], [0.58, 0.06], [REAR_TRANSOM_W, 0.14],
    [REAR_TRANSOM_W, 0.47], [0.58, REAR_TRANSOM_Y], [-0.58, REAR_TRANSOM_Y], [-REAR_TRANSOM_W, 0.47]
  ] as [number, number][];

  const tunnelHole = [
    [-REAR_TRANSOM_W + 0.035, 0.15], [-0.57, 0.095], [0.57, 0.095], [REAR_TRANSOM_W - 0.035, 0.15],
    [REAR_TRANSOM_W - 0.035, 0.46], [0.57, REAR_TRANSOM_Y - 0.035], [-0.57, REAR_TRANSOM_Y - 0.035], [-REAR_TRANSOM_W + 0.035, 0.46]
  ] as [number, number][];

  const diffuserShape = new THREE.Shape(tunnelOuter.map(([x, y]) => new THREE.Vector2(x, y)));
  diffuserShape.holes.push(new THREE.Path(tunnelHole.map(([x, y]) => new THREE.Vector2(x, y)).reverse()));
  const diffuserMesh = new THREE.Mesh(new THREE.ExtrudeGeometry(diffuserShape, { depth: 0.2, bevelEnabled: false }), materials.carbon);
  diffuserMesh.position.z = diffuserZ - 0.2;
  bodyGroup.add(diffuserMesh);

  const diffuserBackingShape = new THREE.Shape(tunnelOuter.map(([x, y]) => new THREE.Vector2(x, y)));
  const diffuserBackingMesh = new THREE.Mesh(new THREE.ShapeGeometry(diffuserBackingShape), materials.cavity);
  diffuserBackingMesh.position.z = diffuserZ - 0.19;
  bodyGroup.add(diffuserBackingMesh);

  bodyGroup.add(createBoxMesh(1.24, 0.09, 0.12, materials.carbon, 0, 0.475, diffuserZ - 0.07));
  bodyGroup.add(createBoxMesh(1.24, 0.018, 0.16, materials.carbon, 0, 0.418, diffuserZ - 0.08));
  bodyGroup.add(createBoxMesh(1.2, 0.1, 0.1, materials.carbon, 0, 0.14, diffuserZ - 0.06));

  // Diffuser vertical carbon strake fins
  for (const x of [-0.31, 0, 0.31]) {
    bodyGroup.add(createBoxMesh(0.012, 0.22, 0.14, materials.carbon, x, 0.305, diffuserZ - 0.08));
  }

  // 4 Diffuser rotating turbine cooling fans
  const fanBladeGeo = new THREE.BoxGeometry(0.06, 0.03, 0.005);
  const fanTurbines: { rotor: THREE.Group }[] = [];
  for (const x of [-0.46, -0.155, 0.155, 0.46]) {
    const fan = createDiffuserFan(materials, fanBladeGeo);
    fan.fan.position.set(x, 0.305, diffuserZ - 0.11);
    bodyGroup.add(fan.fan);
    fanTurbines.push(fan);
  }

  // ── 5. Authentic Physical Cold Gas Thruster Rocket Bell Mounts ──
  const nozzleRimGeo = new THREE.TorusGeometry(0.04, 0.011, 8, 20);
  const nozzleApertureGeo = new THREE.CircleGeometry(0.036, 16);
  const nozzleBellGeo = new THREE.CylinderGeometry(0.044, 0.034, 1, 16);
  const nozzleDummies: Record<string, THREE.Object3D> = {};
  const nozzleApertures: { id: string; mat: THREE.MeshBasicMaterial }[] = [];

  const addNozzle = (id: string, pos: THREE.Vector3, dir: THREE.Vector3, bellLen = 0) => {
    const dummy = new THREE.Object3D();
    dummy.position.copy(pos);
    dummy.userData.dir = dir.clone().normalize();
    bodyGroup.add(dummy);
    nozzleDummies[id] = dummy;

    if (bellLen > 0) {
      const bellGroup = new THREE.Group();
      const rim = new THREE.Mesh(nozzleRimGeo, materials.gold);
      const apertureMat = new THREE.MeshBasicMaterial({ color: 0x2a2420 });
      const aperture = new THREE.Mesh(nozzleApertureGeo, apertureMat);
      aperture.position.z = -0.006;
      nozzleApertures.push({ id, mat: apertureMat });

      const bell = new THREE.Mesh(nozzleBellGeo, materials.gold);
      bell.scale.y = bellLen;
      bell.rotation.x = Math.PI / 2;
      bell.position.z = -bellLen / 2;

      bellGroup.add(rim, aperture, bell);
      bellGroup.position.copy(pos);
      bellGroup.lookAt(pos.clone().add(dir));
      bodyGroup.add(bellGroup);
    }
  };

  // 4 Rear thrusters in diffuser cluster
  [-0.39, -0.13, 0.13, 0.39].forEach((x, idx) => {
    addNozzle(`R${idx + 1}`, new THREE.Vector3(x, 0.475, diffuserZ + 0.01), new THREE.Vector3(0, 0, 1), 0.08);
  });
  // 4 Lift thrusters on floor pan
  addNozzle('L1', new THREE.Vector3(-0.58, 0.07, -1.82), new THREE.Vector3(0, -1, 0), 0.10);
  addNozzle('L2', new THREE.Vector3(0.58, 0.07, -1.82), new THREE.Vector3(0, -1, 0), 0.10);
  addNozzle('L3', new THREE.Vector3(-0.79, 0.05, 2.16), new THREE.Vector3(0, -1, 0), 0.12);
  addNozzle('L4', new THREE.Vector3(0.79, 0.05, 2.16), new THREE.Vector3(0, -1, 0), 0.12);
  // 2 Side flank thrusters
  const flankPt = sampleBodyCurve(-0.25, 'P1', 'P2', 0.15, 0);
  addNozzle('S1', new THREE.Vector3(-flankPt.x, flankPt.y, -0.25), new THREE.Vector3(-1, 0, 0), 0.06);
  addNozzle('S2', new THREE.Vector3(flankPt.x, flankPt.y, -0.25), new THREE.Vector3(1, 0, 0), 0.06);

  // ── 6. Deployable Active Aero Rear Wing ──
  const wingBaseY = 0.945;
  const wingChord = 0.37;
  const wingElevation = 0.36;

  const wingRoot = new THREE.Group();
  const buildWingSection = (w: number, offsetX: number) => {
    const grp = new THREE.Group();
    const mainSection = createBoxMesh(w, 0.035, wingChord, materials.wing, offsetX, 0, 0);
    mainSection.rotation.x = -0.07;
    grp.add(mainSection, createBoxMesh(w, 0.028, 0.018, materials.carbon, offsetX, 0.03, wingChord / 2));
    return grp;
  };

  wingRoot.add(buildWingSection(0.88, 0));

  const wingJoints: { j1: THREE.Group; j2: THREE.Group; side: number }[] = [];
  const wingEndplates: THREE.Group[] = [];

  for (const side of [-1, 1]) {
    const j1 = new THREE.Group();
    j1.position.x = side * 0.44;
    j1.add(buildWingSection(0.27, side * 0.135));

    const j2 = new THREE.Group();
    j2.position.x = side * 0.27;
    j2.add(buildWingSection(0.22, side * 0.11));

    const endplateGrp = new THREE.Group();
    endplateGrp.position.x = side * 0.225;
    const endplate = createBoxMesh(0.02, 0.26, wingChord + 0.12, materials.wing, 0, 0, 0.02);
    endplateGrp.add(endplate);
    endplateGrp.add(createBoxMesh(0.024, 0.21, 0.02, materials.taillight, 0, -0.01, wingChord / 2 + 0.08));

    j2.add(endplateGrp);
    j1.add(j2);
    wingRoot.add(j1);
    wingJoints.push({ j1, j2, side });
    wingEndplates.push(endplateGrp);
  }

  // Dual vertical carbon support pylons
  const wingPylons: THREE.Mesh[] = [];
  for (const side of [-1, 1]) {
    const pylon = createBoxMesh(0.018, wingElevation, 0.09, materials.carbon, side * 0.42, -wingElevation / 2, 0.02);
    wingRoot.add(pylon);
    wingPylons.push(pylon);
  }

  wingRoot.position.set(0, wingBaseY, 2.05);
  bodyGroup.add(wingRoot);

  let currentWingT = 0;
  const setWing = (t: number) => {
    currentWingT = THREE.MathUtils.clamp(t, 0, 1);
    wingRoot.position.y = wingBaseY + currentWingT * wingElevation;
    wingRoot.rotation.x = -currentWingT * 0.05;
    wingRoot.scale.x = 0.9 + 0.1 * currentWingT;

    for (const { j1, j2, side } of wingJoints) {
      j1.rotation.z = -side * 0.08 * currentWingT;
      j2.rotation.z = -side * 0.14 * currentWingT;
    }
    for (const p of wingPylons) {
      p.visible = currentWingT > 0.02;
      p.scale.y = Math.max(0.02, currentWingT);
      p.position.y = (-wingElevation / 2) * currentWingT;
    }
    for (const e of wingEndplates) {
      e.visible = currentWingT > 0.05;
      e.scale.y = Math.max(0.05, currentWingT);
      e.position.y = -0.088 * currentWingT;
    }
  };

  // ── 7. Assemble 4 Wheels with Front Steering Articulation ──
  const wheelAssemblies: { wheel: THREE.Group; spin: THREE.Group; front: boolean }[] = [];
  const frontWheels: THREE.Object3D[] = [];
  const caliperGeo = createBrakeCaliperGeometry();

  for (const z of [FRONT_AXLE_Z, REAR_AXLE_Z]) {
    const isFront = z < 0;
    for (const side of [-1, 1]) {
      const assembly = createWheelAssembly(materials, side, caliperGeo);
      assembly.wheel.position.set(side * TRACK_HALF_WIDTH, WHEEL_RADIUS, z);
      rootGroup.add(assembly.wheel);
      wheelAssemblies.push({ ...assembly, front: isFront });
      if (isFront) {
        frontWheels.push(assembly.wheel);
      }
    }
  }

  // Shadow casting
  rootGroup.traverse(child => {
    if ((child as THREE.Mesh).isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });

  return {
    group: rootGroup,
    body: bodyGroup,
    wheels: wheelAssemblies,
    frontWheels,
    materials,
    setWing,
    getWingT: () => currentWingT,
    setTaillight: (intensity: number) => {
      (materials.taillight as THREE.MeshStandardMaterial).emissiveIntensity = 2.4 * intensity;
      taillightHaloMat.opacity = Math.min(1.0, 0.45 * intensity);
    },
    setNozzleGlow: (id: string, level: number) => {
      const entry = nozzleApertures.find(a => a.id === id);
      if (!entry) return;
      const lvl = Math.min(1, Math.max(0, level));
      entry.mat.color.setRGB(0.16 + lvl * 2.2, 0.15 + lvl * 2.3, 0.13 + lvl * 2.5);
    },
    setPlate: (text: string) => {
      if (plateMat.map) plateMat.map.dispose();
      plateMat.map = createPlateTexture(text);
      plateMat.needsUpdate = true;
    },
    updateFans: (dt: number) => {
      for (const fan of fanTurbines) {
        fan.rotor.rotation.z += dt * 9;
      }
    },
  };
}
