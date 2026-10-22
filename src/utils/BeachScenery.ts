/**
 * BeachScenery.ts — Authentic GTA Vice City "Ocean Beach" & Lummus Park coastal scenery.
 * Generates:
 * - Low Art Deco white stucco seawall and pedestrian promenade.
 * - Lummus Park green coastal turf with sandy pathways and tropical palm groves.
 * - Expansive golden sand beach with gentle dunes.
 * - Iconic Miami Art Deco wooden Lifeguard Towers with pastel stripes, elevated observation decks,
 *   and rooftop flags.
 * - Striped beach umbrellas and wooden chaise lounge chairs.
 * - Deep nocturnal ocean water with night specular highlights and shoreline foam.
 */
import * as THREE from 'three';

export interface BeachMaterials {
  sand: THREE.MeshStandardMaterial;
  grass: THREE.MeshStandardMaterial;
  seawall: THREE.MeshStandardMaterial;
  water: THREE.MeshStandardMaterial;
  foam: THREE.MeshStandardMaterial;
  woodStilts: THREE.MeshStandardMaterial;
  towerPink: THREE.MeshStandardMaterial;
  towerTeal: THREE.MeshStandardMaterial;
  towerYellow: THREE.MeshStandardMaterial;
  towerCoral: THREE.MeshStandardMaterial;
  umbrellaPink: THREE.MeshStandardMaterial;
  umbrellaCyan: THREE.MeshStandardMaterial;
  umbrellaYellow: THREE.MeshStandardMaterial;
  loungerWood: THREE.MeshStandardMaterial;
  palmTrunk: THREE.MeshStandardMaterial;
  palmFrond: THREE.MeshStandardMaterial;
}

export class BeachScenery {
  private static mats: BeachMaterials | null = null;

  private static waveTexture: THREE.CanvasTexture | null = null;

  /** Procedural directional ocean ripple bump texture */
  public static getOceanWaveTexture(): THREE.CanvasTexture {
    if (this.waveTexture) return this.waveTexture;
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;
    const imgData = ctx.createImageData(256, 256);
    const d = imgData.data;

    for (let y = 0; y < 256; y++) {
      for (let x = 0; x < 256; x++) {
        const u = x / 256;
        const v = y / 256;
        // Directional ocean swell angled gently toward shore
        const wave1 = Math.sin(u * Math.PI * 8 + v * Math.PI * 4);
        const wave2 = Math.sin(u * Math.PI * 14 - v * Math.PI * 6);
        const wave3 = Math.cos(v * Math.PI * 10);
        const heightVal = Math.floor(128 + 65 * wave1 + 35 * wave2 + 20 * wave3);
        const clamped = Math.max(0, Math.min(255, heightVal));

        const idx = (y * 256 + x) * 4;
        d[idx] = clamped;
        d[idx + 1] = clamped;
        d[idx + 2] = clamped;
        d[idx + 3] = 255;
      }
    }
    ctx.putImageData(imgData, 0, 0);

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(12, 6);
    this.waveTexture = tex;
    return tex;
  }

  public static getMaterials(): BeachMaterials {
    if (this.mats) return this.mats;

    this.mats = {
      sand: new THREE.MeshStandardMaterial({
        color: 0xdfbe8c,
        roughness: 0.92,
        metalness: 0.04,
      }),
      grass: new THREE.MeshStandardMaterial({
        color: 0x2e6b3c, // Rich tropical coastal lawn
        roughness: 0.88,
        metalness: 0.05,
      }),
      seawall: new THREE.MeshStandardMaterial({
        color: 0xf1f5f9,
        roughness: 0.65,
        metalness: 0.05,
      }),
      water: new THREE.MeshStandardMaterial({
        color: 0x0891b2, // Vibrant Caribbean cyan/turquoise
        roughness: 0.22,
        metalness: 0.30,
        bumpMap: this.getOceanWaveTexture(),
        bumpScale: 0.14,
      }),
      foam: new THREE.MeshStandardMaterial({
        color: 0xffffff, // Pure white crest foam
        emissive: 0xccfbf1,
        emissiveIntensity: 0.45,
        roughness: 0.35,
        metalness: 0.05,
      }),
      woodStilts: new THREE.MeshStandardMaterial({
        color: 0x5c4033,
        roughness: 0.88,
        metalness: 0.08,
      }),
      towerPink: new THREE.MeshStandardMaterial({
        color: 0xf43f5e,
        roughness: 0.55,
        metalness: 0.1,
      }),
      towerTeal: new THREE.MeshStandardMaterial({
        color: 0x06b6d4,
        roughness: 0.55,
        metalness: 0.1,
      }),
      towerYellow: new THREE.MeshStandardMaterial({
        color: 0xfbbf24,
        roughness: 0.55,
        metalness: 0.1,
      }),
      towerCoral: new THREE.MeshStandardMaterial({
        color: 0xf97316,
        roughness: 0.55,
        metalness: 0.1,
      }),
      umbrellaPink: new THREE.MeshStandardMaterial({
        color: 0xf43f5e,
        roughness: 0.7,
        metalness: 0.05,
      }),
      umbrellaCyan: new THREE.MeshStandardMaterial({
        color: 0x06b6d4,
        roughness: 0.7,
        metalness: 0.05,
      }),
      umbrellaYellow: new THREE.MeshStandardMaterial({
        color: 0xfacc15,
        roughness: 0.7,
        metalness: 0.05,
      }),
      loungerWood: new THREE.MeshStandardMaterial({
        color: 0x854d0e,
        roughness: 0.75,
        metalness: 0.1,
      }),
      palmTrunk: new THREE.MeshStandardMaterial({
        color: 0x473c35,
        roughness: 0.9,
      }),
      palmFrond: new THREE.MeshStandardMaterial({
        color: 0x276738,
        roughness: 0.72,
        metalness: 0.05,
      }),
    };

    return this.mats;
  }

  /**
   * Builds an iconic Miami Beach / GTA Vice City Art Deco Lifeguard Tower
   * Elevated wooden stilt base, access ladder, observation shack, and stepped pastel roof with flag.
   */
  public static createLifeguardTower(theme: 'pinkTeal' | 'yellowCoral' | 'tealYellow' = 'pinkTeal'): THREE.Group {
    const m = this.getMaterials();
    const group = new THREE.Group();

    const primaryMat = theme === 'pinkTeal' ? m.towerPink : theme === 'yellowCoral' ? m.towerYellow : m.towerTeal;
    const secondaryMat = theme === 'pinkTeal' ? m.towerTeal : theme === 'yellowCoral' ? m.towerCoral : m.towerYellow;

    // 4 Wooden stilts foundation
    const stiltHeight = 2.2;
    const stiltGeo = new THREE.CylinderGeometry(0.09, 0.11, stiltHeight, 6);
    const spacingX = 1.6;
    const spacingZ = 1.6;

    for (const sx of [-spacingX / 2, spacingX / 2]) {
      for (const sz of [-spacingZ / 2, spacingZ / 2]) {
        const stilt = new THREE.Mesh(stiltGeo, m.woodStilts);
        stilt.position.set(sx, stiltHeight / 2, sz);
        stilt.rotation.x = sz > 0 ? 0.08 : -0.08;
        stilt.rotation.z = sx > 0 ? -0.08 : 0.08;
        stilt.castShadow = true;
        group.add(stilt);
      }
    }

    // Wooden deck platform
    const deckGeo = new THREE.BoxGeometry(2.6, 0.14, 2.6);
    const deck = new THREE.Mesh(deckGeo, m.woodStilts);
    deck.position.y = stiltHeight + 0.07;
    deck.castShadow = true;
    group.add(deck);

    // Deck perimeter safety railing
    const railMat = m.woodStilts;
    for (const side of [-1.25, 1.25]) {
      const railH = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.06, 0.06), railMat);
      railH.position.set(0, stiltHeight + 0.85, side);
      const railV = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 2.5), railMat);
      railV.position.set(side, stiltHeight + 0.85, 0);
      group.add(railH, railV);
    }

    // Wooden access stairs facing the beach
    const rampGeo = new THREE.BoxGeometry(0.8, 0.08, 2.8);
    const ramp = new THREE.Mesh(rampGeo, m.woodStilts);
    ramp.rotation.x = Math.PI / 6;
    ramp.position.set(0, stiltHeight / 2, 1.8);
    ramp.castShadow = true;
    group.add(ramp);

    // Enclosed observation cabin (striped pastel planks)
    const cabinH = 1.8;
    const cabinGeo = new THREE.BoxGeometry(1.8, cabinH, 1.8);
    const cabin = new THREE.Mesh(cabinGeo, primaryMat);
    cabin.position.y = stiltHeight + 0.14 + cabinH / 2;
    cabin.castShadow = true;
    group.add(cabin);

    // Contrasting decorative stripe around cabin waist
    const stripeGeo = new THREE.BoxGeometry(1.86, 0.32, 1.86);
    const stripe = new THREE.Mesh(stripeGeo, secondaryMat);
    stripe.position.y = stiltHeight + 0.14 + cabinH * 0.45;
    group.add(stripe);

    // 4 Lookout window bands
    const winGeo = new THREE.BoxGeometry(1.84, 0.45, 1.84);
    const winMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.1,
      metalness: 0.9,
    });
    const win = new THREE.Mesh(winGeo, winMat);
    win.position.y = stiltHeight + 0.14 + cabinH * 0.72;
    group.add(win);

    // Art Deco overhanging pagoda / stepped roof
    const roofBaseGeo = new THREE.BoxGeometry(2.4, 0.22, 2.4);
    const roofBase = new THREE.Mesh(roofBaseGeo, secondaryMat);
    roofBase.position.y = stiltHeight + 0.14 + cabinH + 0.11;
    roofBase.castShadow = true;

    const roofCapGeo = new THREE.ConeGeometry(1.5, 0.85, 4);
    const roofCap = new THREE.Mesh(roofCapGeo, primaryMat);
    roofCap.rotation.y = Math.PI / 4;
    roofCap.position.y = stiltHeight + 0.14 + cabinH + 0.22 + 0.42;
    roofCap.castShadow = true;
    group.add(roofBase, roofCap);

    // Flagpole with waving pennant
    const poleGeo = new THREE.CylinderGeometry(0.02, 0.03, 1.4, 6);
    const pole = new THREE.Mesh(poleGeo, m.woodStilts);
    pole.position.y = stiltHeight + 0.14 + cabinH + 1.2;

    const flagGeo = new THREE.PlaneGeometry(0.65, 0.32);
    const flag = new THREE.Mesh(flagGeo, secondaryMat);
    flag.position.set(0.35, stiltHeight + 0.14 + cabinH + 1.6, 0);
    group.add(pole, flag);

    return group;
  }

  /**
   * Beach Umbrella and dual Chaise Lounge Chairs
   */
  public static createUmbrellaSet(color: 'pink' | 'cyan' | 'yellow' = 'pink'): THREE.Group {
    const m = this.getMaterials();
    const group = new THREE.Group();

    const uMat = color === 'pink' ? m.umbrellaPink : color === 'cyan' ? m.umbrellaCyan : m.umbrellaYellow;

    // Pole
    const poleGeo = new THREE.CylinderGeometry(0.035, 0.04, 2.4, 8);
    const pole = new THREE.Mesh(poleGeo, m.woodStilts);
    pole.position.y = 1.2;
    pole.rotation.z = 0.08;
    pole.castShadow = true;
    group.add(pole);

    // Hexagonal canopy
    const canopyGeo = new THREE.ConeGeometry(1.4, 0.55, 6);
    const canopy = new THREE.Mesh(canopyGeo, uMat);
    canopy.position.set(0.1, 2.3, 0);
    canopy.rotation.z = 0.08;
    canopy.castShadow = true;
    group.add(canopy);

    // Two wooden lounge chairs
    for (const zOff of [-0.65, 0.65]) {
      const lounger = new THREE.Group();
      // Seat
      const seat = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.06, 1.5), m.loungerWood);
      seat.position.set(0, 0.22, 0);
      seat.castShadow = true;
      // Angled backrest
      const back = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.06, 0.8), m.loungerWood);
      back.rotation.x = -Math.PI / 4;
      back.position.set(0, 0.5, 0.7);
      back.castShadow = true;
      lounger.add(seat, back);
      lounger.position.set(0.2, 0, zOff);
      group.add(lounger);
    }

    return group;
  }

  /**
   * Curved Miami Royal Palm Tree
   */
  public static createMiamiPalm(height = 8.5, leanAngle = -0.18): THREE.Group {
    const m = this.getMaterials();
    const palm = new THREE.Group();

    // Curved slender trunk
    const curvePts: THREE.Vector3[] = [];
    const segs = 8;
    for (let i = 0; i <= segs; i++) {
      const frac = i / segs;
      const y = frac * height;
      const x = Math.sin(frac * Math.PI * 0.7) * (height * leanAngle * 0.4);
      curvePts.push(new THREE.Vector3(x, y, 0));
    }
    const trunkCurve = new THREE.CatmullRomCurve3(curvePts);
    const trunkGeo = new THREE.TubeGeometry(trunkCurve, 12, 0.16, 6, false);
    const trunk = new THREE.Mesh(trunkGeo, m.palmTrunk);
    trunk.castShadow = true;
    palm.add(trunk);

    // Tropical frond crown
    const topPt = curvePts[curvePts.length - 1];
    const frondGeo = new THREE.ConeGeometry(2.6, 2.8, 6);

    for (let i = 0; i < 4; i++) {
      const frond = new THREE.Mesh(frondGeo, m.palmFrond);
      frond.position.set(topPt.x, topPt.y - 0.2 + i * 0.35, topPt.z);
      frond.scale.set(1.0 - i * 0.12, 0.45, 1.0 - i * 0.12);
      frond.rotation.y = i * 1.6;
      frond.rotation.z = leanAngle * 0.5;
      frond.castShadow = true;
      palm.add(frond);
    }

    return palm;
  }
}
