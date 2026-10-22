/**
 * RoadChunk.ts — GTA Vice City Ocean Drive Highway Segment.
 * - Right side: Iconic Vice City Art Deco hotels (The Pink Wave, Emerald Arch, Moderne, Sunburst)
 *   with glowing neon signs, wavy rooflines, neon arches, balconies, warm lobby windows,
 *   sidewalk promenade, tall Queen palms, streetlamps, and parked retro cruisers.
 * - Left side: "Ocean Beach" & Lummus Park with green coastal lawn, low Art Deco seawall,
 *   expansive golden sand beach, iconic striped Art Deco lifeguard towers, umbrellas,
 *   loungers, and deep turquoise/indigo nocturnal ocean water.
 * - Center: Photorealistic asphalt with iconic GTA Vice City double solid yellow center lines,
 *   dashed lane dividers, cat's eyes, and curbs.
 */
import * as THREE from 'three';
import { RoadTextureGenerator } from '@utils/RoadTextureGenerator';
import { ViceCityBuildings } from '@utils/ViceCityBuildings';
import { BeachScenery } from '@utils/BeachScenery';

const CHUNK_LENGTH = 50;  // meters
const OVERLAP_LENGTH = CHUNK_LENGTH + 2.0; // Overlap prevents visible seams when chunks curve along turns
const ROAD_WIDTH = 11.5;  // 3 lanes (each 3.5m) + shoulders
const LANE_WIDTH = 3.5;

export class RoadChunk {
  public readonly group: THREE.Group;
  public readonly length = CHUNK_LENGTH;
  public readonly palmSlots: THREE.Object3D[] = [];

  constructor(chunkIndex: number = 0) {
    this.group = new THREE.Group();

    // ── 1. Photorealistic Asphalt Road Surface ───────────
    const textures = RoadTextureGenerator.getTextures();
    const roadGeo = new THREE.PlaneGeometry(ROAD_WIDTH, OVERLAP_LENGTH, 1, 1);
    const roadMat = new THREE.MeshStandardMaterial({
      map: textures.diffuse,
      roughnessMap: textures.roughness,
      bumpMap: textures.bump,
      bumpScale: 0.035,
      roughness: 0.82,
      metalness: 0.12,
    });
    const road = new THREE.Mesh(roadGeo, roadMat);
    road.rotation.x = -Math.PI / 2;
    road.position.y = 0;
    road.receiveShadow = true;
    this.group.add(road);

    // ── 2. Concrete Curbs (Separating road from sidewalks) ──
    const curbGeo = new THREE.BoxGeometry(0.35, 0.16, OVERLAP_LENGTH);
    const curbMat = new THREE.MeshStandardMaterial({
      color: 0x949089,
      roughness: 0.75,
      metalness: 0.1,
    });
    for (const sign of [-1, 1]) {
      const curb = new THREE.Mesh(curbGeo, curbMat);
      curb.position.set(sign * (ROAD_WIDTH / 2 + 0.175), 0.08, 0);
      curb.receiveShadow = true;
      this.group.add(curb);
    }

    // ── 3. White Dashed Lane Dividers ────────────────────
    const dashGeo = new THREE.PlaneGeometry(0.14, 3.2, 1, 1);
    const dashMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.35,
      metalness: 0.05,
      emissive: 0x333333,
      emissiveIntensity: 0.4,
    });

    for (const divX of [-LANE_WIDTH / 2, LANE_WIDTH / 2]) { // -1.75 and +1.75
      for (let z = -CHUNK_LENGTH / 2 + 3; z < CHUNK_LENGTH / 2; z += 9) {
        const dash = new THREE.Mesh(dashGeo, dashMat);
        dash.rotation.x = -Math.PI / 2;
        dash.position.set(divX, 0.012, z);
        this.group.add(dash);
      }
    }

    // ── 4. Solid White Outer Edge Lines ──────────────────
    const edgeGeo = new THREE.PlaneGeometry(0.16, OVERLAP_LENGTH, 1, 1);
    for (const sign of [-1, 1]) {
      const edge = new THREE.Mesh(edgeGeo, dashMat);
      edge.rotation.x = -Math.PI / 2;
      edge.position.set(sign * (ROAD_WIDTH / 2 - 0.22), 0.012, 0);
      this.group.add(edge);
    }

    // ── 6. RIGHT SIDE: GTA Vice City Ocean Drive Hotel Strip ──
    this._createViceCityRightSide(chunkIndex);

    // ── 7. LEFT SIDE: Ocean Beach, Promenade & Lummus Park ──
    this._createBeachLeftSide(chunkIndex);

    // ── 8. Overhead Art Deco Avenue Gantry (Every 3rd chunk) ──
    if (chunkIndex % 3 === 0) {
      this._createViceCityGantry();
    }
  }

  /**
   * Builds the right side: wide concrete sidewalk, retro streetlamps,
   * tall Queen palms, parked retro cruisers, and authentic Art Deco hotels.
   */
  private _createViceCityRightSide(chunkIndex: number): void {
    const sidewalkWidth = 5.75;
    const sidewalkX = ROAD_WIDTH / 2 + sidewalkWidth / 2;

    // Raised concrete sidewalk slab
    const sidewalkGeo = new THREE.BoxGeometry(sidewalkWidth, 0.14, OVERLAP_LENGTH);
    const sidewalkMat = new THREE.MeshStandardMaterial({
      color: 0xd8d3c8,
      roughness: 0.88,
      metalness: 0.05,
    });
    const sidewalk = new THREE.Mesh(sidewalkGeo, sidewalkMat);
    sidewalk.position.set(sidewalkX, 0.07, 0);
    sidewalk.receiveShadow = true;
    this.group.add(sidewalk);

    // Sidewalk streetlamps (Vintage curved Miami streetlights with warm amber lanterns)
    for (let z = -CHUNK_LENGTH / 2 + 12; z < CHUNK_LENGTH / 2; z += 25) {
      const lamp = this._createVintageStreetlamp();
      lamp.position.set(ROAD_WIDTH / 2 + 1.4, 0, z);
      this.group.add(lamp);
    }

    // Sidewalk tropical palm trees
    for (let z = -CHUNK_LENGTH / 2 + 7; z < CHUNK_LENGTH / 2; z += 18) {
      const palm = BeachScenery.createMiamiPalm(9.2, 0.12);
      palm.position.set(ROAD_WIDTH / 2 + 4.2, 0, z);
      this.palmSlots.push(palm);
      this.group.add(palm);
    }

    // Parked retro cruiser along the curb on alternating chunks
    if (chunkIndex % 2 === 0) {
      const colors: ('pink' | 'turquoise' | 'yellow')[] = ['pink', 'turquoise', 'yellow'];
      const color = colors[chunkIndex % colors.length];
      const car = ViceCityBuildings.createParkedRetroCar(color);
      car.position.set(ROAD_WIDTH / 2 + 2.1, 0, -CHUNK_LENGTH / 4);
      car.rotation.y = Math.PI; // Facing parallel to curb
      this.group.add(car);
    }

    // ── Two Authentic Art Deco Hotel Buildings per 50m Chunk ──
    const buildingBaseX = ROAD_WIDTH / 2 + sidewalkWidth; // x = 11.5

    // Hotel 1 (Rear half: z = -CHUNK_LENGTH / 4)
    const bldg1 = this._selectHotelArchetype(chunkIndex * 2);
    bldg1.position.set(buildingBaseX, 0, -CHUNK_LENGTH / 4);
    this.group.add(bldg1);

    // Hotel 2 (Front half: z = +CHUNK_LENGTH / 4)
    const bldg2 = this._selectHotelArchetype(chunkIndex * 2 + 1);
    bldg2.position.set(buildingBaseX, 0, CHUNK_LENGTH / 4);
    this.group.add(bldg2);
  }

  /** Selects one of the 4 iconic Vice City Art Deco hotel archetypes */
  private _selectHotelArchetype(idx: number): THREE.Group {
    const type = idx % 4;
    switch (type) {
      case 0:
        return ViceCityBuildings.createPinkWaveHotel(24.0, 24.0, 15.0);
      case 1:
        return ViceCityBuildings.createEmeraldArchHotel(24.0, 28.0, 15.0);
      case 2:
        return ViceCityBuildings.createModerneHotel(24.0, 22.0, 15.0);
      case 3:
      default:
        return ViceCityBuildings.createSunburstHotel(24.0, 26.0, 15.0);
    }
  }

  /**
   * Builds the left side: pedestrian promenade, low Art Deco seawall,
   * Lummus Park green turf with palm groves, golden sand beach,
   * striped lifeguard towers, beach umbrellas, and nocturnal ocean water.
   */
  private _createBeachLeftSide(chunkIndex: number): void {
    const bm = BeachScenery.getMaterials();

    // 1. Promenade Sidewalk (x = -5.75 to -7.95, width 2.2m)
    const promW = 2.2;
    const promX = -ROAD_WIDTH / 2 - promW / 2; // -6.85
    const promGeo = new THREE.BoxGeometry(promW, 0.14, OVERLAP_LENGTH);
    const prom = new THREE.Mesh(promGeo, bm.seawall);
    prom.position.set(promX, 0.07, 0);
    prom.receiveShadow = true;
    this.group.add(prom);

    // Promenade streetlamps
    for (let z = -CHUNK_LENGTH / 2 + 15; z < CHUNK_LENGTH / 2; z += 30) {
      const lamp = this._createVintageStreetlamp(true);
      lamp.position.set(-ROAD_WIDTH / 2 - 1.0, 0, z);
      this.group.add(lamp);
    }

    // 2. Art Deco White Stucco Seawall along x = -7.95
    const seawallX = -ROAD_WIDTH / 2 - promW; // -7.95
    const wallGeo = new THREE.BoxGeometry(0.35, 0.55, OVERLAP_LENGTH);
    const wall = new THREE.Mesh(wallGeo, bm.seawall);
    wall.position.set(seawallX, 0.275, 0);
    wall.castShadow = true;
    wall.receiveShadow = true;
    this.group.add(wall);

    // Decorative pilasters along the seawall every 10m
    const pilasterGeo = new THREE.BoxGeometry(0.44, 0.68, 0.44);
    for (let z = -CHUNK_LENGTH / 2 + 5; z < CHUNK_LENGTH / 2; z += 10) {
      const pilaster = new THREE.Mesh(pilasterGeo, bm.seawall);
      pilaster.position.set(seawallX, 0.34, z);
      pilaster.castShadow = true;
      this.group.add(pilaster);
    }

    // 3. Lummus Park Green Coastal Turf (x = -7.95 to -12.45, width 4.5m)
    const parkW = 4.5;
    const parkX = seawallX - parkW / 2; // -10.20
    const parkGeo = new THREE.PlaneGeometry(parkW, OVERLAP_LENGTH, 1, 1);
    const park = new THREE.Mesh(parkGeo, bm.grass);
    park.rotation.x = -Math.PI / 2;
    park.position.set(parkX, 0.03, 0);
    park.receiveShadow = true;
    this.group.add(park);

    // Tropical Palm Trees in Lummus Park (spaced nicely at 22m intervals so ocean remains clearly visible)
    for (let z = -CHUNK_LENGTH / 2 + 8; z < CHUNK_LENGTH / 2; z += 22) {
      const palm = BeachScenery.createMiamiPalm(8.8, -0.22);
      palm.position.set(parkX, 0.03, z);
      this.palmSlots.push(palm);
      this.group.add(palm);
    }

    // 4. Golden Sand Ocean Beach (x = -12.45 to -24.5, width 12.05m)
    const beachW = 12.05;
    const beachX = seawallX - parkW - beachW / 2; // -18.475
    const beachGeo = new THREE.PlaneGeometry(beachW, OVERLAP_LENGTH, 1, 1);
    const beach = new THREE.Mesh(beachGeo, bm.sand);
    beach.rotation.x = -Math.PI / 2;
    beach.position.set(beachX, -0.12, 0);
    beach.receiveShadow = true;
    this.group.add(beach);

    // 5. Miami Art Deco Lifeguard Tower on alternating chunks (placed on beach at x = -17.5)
    if (chunkIndex % 2 === 0) {
      const themes: ('pinkTeal' | 'yellowCoral' | 'tealYellow')[] = ['pinkTeal', 'yellowCoral', 'tealYellow'];
      const theme = themes[(chunkIndex / 2) % themes.length];
      const tower = BeachScenery.createLifeguardTower(theme);
      tower.position.set(-17.5, -0.12, 0);
      tower.rotation.y = Math.PI / 5; // Angled invitingly toward road and ocean
      this.group.add(tower);
    }

    // 6. Beach Umbrellas & Loungers Set (placed on beach at x = -15.5)
    const colors: ('pink' | 'cyan' | 'yellow')[] = ['pink', 'cyan', 'yellow'];
    for (const z of [-14, 14]) {
      const uColor = colors[Math.abs(chunkIndex + z) % colors.length];
      const umbrella = BeachScenery.createUmbrellaSet(uColor);
      umbrella.position.set(-15.5, -0.12, z);
      this.group.add(umbrella);
    }

    // 7. Shoreline Foam Wash Ribbon (x = -24.5 to -27.5, width 3.0m)
    const foamW = 3.0;
    const foamX = -24.5 - foamW / 2; // -26.0
    const foamGeo = new THREE.PlaneGeometry(foamW, OVERLAP_LENGTH, 1, 1);
    const foam = new THREE.Mesh(foamGeo, bm.foam);
    foam.rotation.x = -Math.PI / 2;
    foam.position.set(foamX, -0.32, 0);
    this.group.add(foam);

    // 8. Ocean Water (x = -24.5 to -350, width 325.5m)
    const oceanW = 325.5;
    const oceanX = -24.5 - oceanW / 2; // -187.25
    const waterGeo = new THREE.PlaneGeometry(oceanW, OVERLAP_LENGTH, 1, 1);
    const ocean = new THREE.Mesh(waterGeo, bm.water);
    ocean.rotation.x = -Math.PI / 2;
    ocean.position.set(oceanX, -0.36, 0);
    ocean.receiveShadow = true;
    this.group.add(ocean);
  }

  /**
   * Vintage curved Miami streetlamp with warm amber lantern
   */
  private _createVintageStreetlamp(facingLeft = false): THREE.Group {
    const lamp = new THREE.Group();
    const poleMat = new THREE.MeshStandardMaterial({
      color: 0x3e4450,
      metalness: 0.75,
      roughness: 0.3,
    });
    const lanternMat = new THREE.MeshStandardMaterial({
      color: 0xffe680,
      emissive: 0xffaa00,
      emissiveIntensity: 2.2,
      roughness: 0.2,
    });

    // Vertical pole
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 6.8, 8), poleMat);
    pole.position.y = 3.4;
    pole.castShadow = true;
    lamp.add(pole);

    // Decorative base ring
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 0.45, 8), poleMat);
    base.position.y = 0.225;
    lamp.add(base);

    // Curved swan-neck arm
    const armX = facingLeft ? 0.75 : -0.75;
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.8, 6), poleMat);
    arm.rotation.z = facingLeft ? -Math.PI / 3.2 : Math.PI / 3.2;
    arm.position.set(armX, 6.6, 0);
    lamp.add(arm);

    // Lantern housing
    const lantern = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.35, 0.4), lanternMat);
    lantern.position.set(facingLeft ? 1.4 : -1.4, 6.4, 0);
    lamp.add(lantern);

    return lamp;
  }

  /**
   * Overhead Art Deco avenue gantry spanning the boulevard
   */
  private _createViceCityGantry(): void {
    const gantry = new THREE.Group();
    const steelMat = new THREE.MeshStandardMaterial({
      color: 0x2d3748,
      metalness: 0.85,
      roughness: 0.25,
    });

    // Dual support towers
    const towerGeo = new THREE.BoxGeometry(0.5, 7.8, 0.5);
    const leftTower = new THREE.Mesh(towerGeo, steelMat);
    leftTower.position.set(-ROAD_WIDTH / 2 - 0.8, 3.9, 0);
    const rightTower = new THREE.Mesh(towerGeo, steelMat);
    rightTower.position.set(ROAD_WIDTH / 2 + 0.8, 3.9, 0);
    gantry.add(leftTower, rightTower);

    // Art Deco curved crossbeam spanning highway
    const beamGeo = new THREE.BoxGeometry(ROAD_WIDTH + 2.2, 0.65, 0.6);
    const beam = new THREE.Mesh(beamGeo, steelMat);
    beam.position.set(0, 7.5, 0);
    gantry.add(beam);

    // Glowing Neon "OCEAN BEACH" / "VICE CITY" sign on crossbeam
    const signGeo = new THREE.PlaneGeometry(8.2, 1.4);
    const signMat = new THREE.MeshBasicMaterial({
      map: ViceCityBuildings.getSignTexture('OCEAN BEACH', '#ff1493', '#ff007f'),
      transparent: true,
      toneMapped: false,
    });
    const signFront = new THREE.Mesh(signGeo, signMat);
    signFront.position.set(0, 7.5, 0.32);
    gantry.add(signFront);

    // Glowing cyan neon underside lightstrip
    const ledGeo = new THREE.BoxGeometry(ROAD_WIDTH + 1.2, 0.08, 0.15);
    const ledMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      toneMapped: false,
    });
    const ledStrip = new THREE.Mesh(ledGeo, ledMat);
    ledStrip.position.set(0, 7.12, 0);
    gantry.add(ledStrip);

    this.group.add(gantry);
  }

  public setPosition(z: number): void {
    this.group.position.z = z;
  }

  public get frontZ(): number {
    return this.group.position.z - CHUNK_LENGTH / 2;
  }

  public get rearZ(): number {
    return this.group.position.z + CHUNK_LENGTH / 2;
  }

  public get centerZ(): number {
    return this.group.position.z;
  }
}
