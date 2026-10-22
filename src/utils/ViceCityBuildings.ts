/**
 * ViceCityBuildings.ts — Authentic GTA Vice City Art Deco Ocean Drive Buildings & Scenery.
 * Generates iconic 1980s Miami Beach architectural styles:
 * - "The Pink Wave" (Colonade style): Cantilevered awning with bright pink neon wave tube,
 *   stepped ziggurat roofline, glowing central fin, and large warm lobby windows.
 * - "The Emerald Arch" (Beacon style): Towering glowing neon green arch, streamline rounded
 *   corners, stepped crown, and illuminated marquee canopy.
 * - "The Moderne" (Clevelander style): Streamline Moderne curved corner balconies with electric
 *   cyan neon railings, rooftop radio beacon spire, and open-air bar facade.
 * - "The Sunburst" (Leslie style): Buttercup yellow facade with white eyebrows, triple-tier
 *   stepped parapet, purple/gold neon accents, and illuminated window grids.
 * - "The Tropicana": Lilac and turquoise twin-tower facade with glowing vertical louvers.
 * - Parked retro classic cruisers along the sidewalk curb with chrome bumpers and pastel paint.
 */
import * as THREE from 'three';

export interface ViceCityMaterials {
  facadePink: THREE.MeshStandardMaterial;
  facadeMint: THREE.MeshStandardMaterial;
  facadePeach: THREE.MeshStandardMaterial;
  facadeYellow: THREE.MeshStandardMaterial;
  facadeLilac: THREE.MeshStandardMaterial;
  facadeWhite: THREE.MeshStandardMaterial;
  facadeNavy: THREE.MeshStandardMaterial;
  sidewalk: THREE.MeshStandardMaterial;
  curb: THREE.MeshStandardMaterial;
  chrome: THREE.MeshStandardMaterial;
  glassWarm: THREE.MeshStandardMaterial;
  glassCyan: THREE.MeshStandardMaterial;
  neonPink: THREE.MeshBasicMaterial;
  neonCyan: THREE.MeshBasicMaterial;
  neonGreen: THREE.MeshBasicMaterial;
  neonYellow: THREE.MeshBasicMaterial;
  neonPurple: THREE.MeshBasicMaterial;
  roofDark: THREE.MeshStandardMaterial;
  carPaintPink: THREE.MeshStandardMaterial;
  carPaintTurquoise: THREE.MeshStandardMaterial;
  carPaintYellow: THREE.MeshStandardMaterial;
  carTire: THREE.MeshStandardMaterial;
}

export class ViceCityBuildings {
  private static mats: ViceCityMaterials | null = null;
  private static sharedWindowTexture: THREE.CanvasTexture | null = null;
  private static signTextures: Map<string, THREE.CanvasTexture> = new Map();

  public static getMaterials(): ViceCityMaterials {
    if (this.mats) return this.mats;

    this.mats = {
      facadePink: new THREE.MeshStandardMaterial({
        color: 0xf06292,
        roughness: 0.65,
        metalness: 0.05,
      }),
      facadeMint: new THREE.MeshStandardMaterial({
        color: 0x38b2ac,
        roughness: 0.6,
        metalness: 0.08,
      }),
      facadePeach: new THREE.MeshStandardMaterial({
        color: 0xfb923c,
        roughness: 0.65,
        metalness: 0.05,
      }),
      facadeYellow: new THREE.MeshStandardMaterial({
        color: 0xfde047,
        roughness: 0.68,
        metalness: 0.05,
      }),
      facadeLilac: new THREE.MeshStandardMaterial({
        color: 0xb388ff,
        roughness: 0.62,
        metalness: 0.06,
      }),
      facadeWhite: new THREE.MeshStandardMaterial({
        color: 0xf8fafc,
        roughness: 0.55,
        metalness: 0.05,
      }),
      facadeNavy: new THREE.MeshStandardMaterial({
        color: 0x0f172a,
        roughness: 0.7,
        metalness: 0.15,
      }),
      sidewalk: new THREE.MeshStandardMaterial({
        color: 0xc8c3b9,
        roughness: 0.85,
        metalness: 0.05,
      }),
      curb: new THREE.MeshStandardMaterial({
        color: 0x8c877e,
        roughness: 0.8,
        metalness: 0.1,
      }),
      chrome: new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.15,
        metalness: 0.95,
      }),
      glassWarm: new THREE.MeshStandardMaterial({
        color: 0xffd166,
        emissive: 0xff9933,
        emissiveIntensity: 1.2,
        roughness: 0.2,
      }),
      glassCyan: new THREE.MeshStandardMaterial({
        color: 0xa5f3fc,
        emissive: 0x06b6d4,
        emissiveIntensity: 0.9,
        roughness: 0.2,
      }),
      neonPink: new THREE.MeshBasicMaterial({
        color: 0xff1493,
        toneMapped: false,
      }),
      neonCyan: new THREE.MeshBasicMaterial({
        color: 0x00f0ff,
        toneMapped: false,
      }),
      neonGreen: new THREE.MeshBasicMaterial({
        color: 0x39ff14,
        toneMapped: false,
      }),
      neonYellow: new THREE.MeshBasicMaterial({
        color: 0xffe600,
        toneMapped: false,
      }),
      neonPurple: new THREE.MeshBasicMaterial({
        color: 0xb324ff,
        toneMapped: false,
      }),
      roofDark: new THREE.MeshStandardMaterial({
        color: 0x1e293b,
        roughness: 0.9,
        metalness: 0.1,
      }),
      carPaintPink: new THREE.MeshStandardMaterial({
        color: 0xf472b6,
        roughness: 0.35,
        metalness: 0.45,
      }),
      carPaintTurquoise: new THREE.MeshStandardMaterial({
        color: 0x2dd4bf,
        roughness: 0.35,
        metalness: 0.45,
      }),
      carPaintYellow: new THREE.MeshStandardMaterial({
        color: 0xfacc15,
        roughness: 0.35,
        metalness: 0.45,
      }),
      carTire: new THREE.MeshStandardMaterial({
        color: 0x18181b,
        roughness: 0.92,
        metalness: 0.1,
      }),
    };

    return this.mats;
  }

  /** Generates an illuminated Art Deco window grid texture */
  private static getWindowTexture(): THREE.CanvasTexture {
    if (this.sharedWindowTexture) return this.sharedWindowTexture;

    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    // Dark exterior wall base
    ctx.fillStyle = '#1e1b2e';
    ctx.fillRect(0, 0, 512, 512);

    const cols = 8;
    const rows = 8;
    const padX = 14;
    const padY = 16;
    const winW = (512 - padX * (cols + 1)) / cols;
    const winH = (512 - padY * (rows + 1)) / rows;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = padX + c * (winW + padX);
        const y = padY + r * (winH + padY);

        const rand = (r * 13 + c * 37) % 100;
        if (rand < 25) {
          // Warm golden interior glow
          ctx.fillStyle = '#ffe082';
          ctx.shadowColor = '#ffb300';
          ctx.shadowBlur = 8;
        } else if (rand < 55) {
          // Hot pink / magenta Miami interior glow
          ctx.fillStyle = '#ff80ab';
          ctx.shadowColor = '#f50057';
          ctx.shadowBlur = 8;
        } else if (rand < 80) {
          // Cool cyan interior glow
          ctx.fillStyle = '#80deea';
          ctx.shadowColor = '#00bcd4';
          ctx.shadowBlur = 8;
        } else {
          // Dark window
          ctx.fillStyle = '#0d0c15';
          ctx.shadowBlur = 0;
        }

        ctx.fillRect(x, y, winW, winH);

        // White window frame mullions
        ctx.strokeStyle = '#ffffffaa';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(x, y, winW, winH);
        ctx.beginPath();
        ctx.moveTo(x + winW / 2, y);
        ctx.lineTo(x + winW / 2, y + winH);
        ctx.stroke();
      }
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    this.sharedWindowTexture = tex;
    return tex;
  }

  /** Generates a glowing neon hotel name sign canvas */
  public static getSignTexture(text: string, colorHex: string, bgGlow: string): THREE.CanvasTexture {
    if (this.signTextures.has(text)) return this.signTextures.get(text)!;

    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;

    // Transparent dark background
    ctx.fillStyle = 'rgba(10, 8, 18, 0.88)';
    ctx.fillRect(0, 0, 512, 128);

    // Outer neon glow border
    ctx.strokeStyle = colorHex;
    ctx.lineWidth = 4;
    ctx.shadowColor = bgGlow;
    ctx.shadowBlur = 16;
    ctx.strokeRect(8, 8, 496, 112);

    // Neon typography
    ctx.font = 'bold 54px "Rajdhani", Impact, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = bgGlow;
    ctx.shadowBlur = 24;
    ctx.fillText(text, 256, 64);
    ctx.fillText(text, 256, 64); // Double draw for neon bloom

    const tex = new THREE.CanvasTexture(canvas);
    this.signTextures.set(text, tex);
    return tex;
  }

  /**
   * Archetype 1: "The Pink Wave" (Colonade style — matches the user's screenshot)
   * Prominent pink stucco, cantilevered awning with sinusoidal pink neon wave tube,
   * stepped ziggurat tower, and glowing vertical fin.
   */
  public static createPinkWaveHotel(widthZ = 22, heightY = 24, depthX = 14): THREE.Group {
    const m = this.getMaterials();
    const group = new THREE.Group();

    // Main building mass
    const mainGeo = new THREE.BoxGeometry(depthX, heightY, widthZ);
    const mainMesh = new THREE.Mesh(mainGeo, m.facadePink);
    mainMesh.position.set(depthX / 2, heightY / 2, 0);
    mainMesh.castShadow = true;
    mainMesh.receiveShadow = true;
    group.add(mainMesh);

    // Upper window grid plane
    const winGeo = new THREE.PlaneGeometry(widthZ * 0.88, heightY * 0.6);
    const winMat = new THREE.MeshBasicMaterial({
      map: this.getWindowTexture(),
      toneMapped: false,
    });
    const winMesh = new THREE.Mesh(winGeo, winMat);
    winMesh.rotation.y = -Math.PI / 2;
    winMesh.position.set(-0.02, heightY * 0.58, 0);
    group.add(winMesh);

    // Ground floor large warm lobby picture window
    const lobbyGeo = new THREE.PlaneGeometry(widthZ * 0.75, 4.2);
    const lobbyMesh = new THREE.Mesh(lobbyGeo, m.glassWarm);
    lobbyMesh.rotation.y = -Math.PI / 2;
    lobbyMesh.position.set(-0.02, 2.5, 0);
    group.add(lobbyMesh);

    // Cantilevered entrance awning over sidewalk
    const awningW = widthZ * 0.82;
    const awningDepth = 3.2;
    const awningGeo = new THREE.BoxGeometry(awningDepth, 0.45, awningW);
    const awning = new THREE.Mesh(awningGeo, m.facadeWhite);
    awning.position.set(-awningDepth / 2, 5.0, 0);
    awning.castShadow = true;
    group.add(awning);

    // ── Glowing Pink Neon Wave Tube along awning edge (Signature GTA Vice City feature!) ──
    const wavePoints: THREE.Vector3[] = [];
    const numWavePts = 36;
    for (let i = 0; i <= numWavePts; i++) {
      const frac = i / numWavePts;
      const z = (frac - 0.5) * awningW;
      const y = 5.0 + Math.sin(frac * Math.PI * 8) * 0.22;
      wavePoints.push(new THREE.Vector3(-awningDepth - 0.05, y, z));
    }
    const waveCurve = new THREE.CatmullRomCurve3(wavePoints);
    const waveGeo = new THREE.TubeGeometry(waveCurve, 48, 0.065, 6, false);
    const waveMesh = new THREE.Mesh(waveGeo, m.neonPink);
    group.add(waveMesh);

    // Stepped rooftop ziggurat crown
    const zigg1 = new THREE.Mesh(new THREE.BoxGeometry(depthX * 0.8, 2.5, widthZ * 0.65), m.facadePink);
    zigg1.position.set(depthX / 2, heightY + 1.25, 0);
    const zigg2 = new THREE.Mesh(new THREE.BoxGeometry(depthX * 0.6, 2.0, widthZ * 0.42), m.facadeWhite);
    zigg2.position.set(depthX / 2, heightY + 3.25, 0);
    group.add(zigg1, zigg2);

    // Rooftop neon crown trim
    const roofNeonGeo = new THREE.BoxGeometry(0.12, 0.12, widthZ * 0.66);
    const roofNeon = new THREE.Mesh(roofNeonGeo, m.neonPink);
    roofNeon.position.set(0, heightY + 2.5, 0);
    group.add(roofNeon);

    // Central vertical illuminated Art Deco fin
    const finGeo = new THREE.BoxGeometry(0.4, heightY + 4.5, 0.4);
    const fin = new THREE.Mesh(finGeo, m.facadeWhite);
    fin.position.set(-0.2, (heightY + 4.5) / 2, 0);
    const finNeon = new THREE.Mesh(new THREE.BoxGeometry(0.08, heightY + 4.0, 0.08), m.neonCyan);
    finNeon.position.set(-0.45, (heightY + 4.0) / 2, 0);
    group.add(fin, finNeon);

    // Illuminated Rooftop Hotel Sign
    const signGeo = new THREE.PlaneGeometry(7.5, 2.0);
    const signMat = new THREE.MeshBasicMaterial({
      map: this.getSignTexture('OCEAN DRIVE', '#ff1493', '#ff007f'),
      transparent: true,
      toneMapped: false,
    });
    const sign = new THREE.Mesh(signGeo, signMat);
    sign.rotation.y = -Math.PI / 2;
    sign.position.set(0, heightY + 4.8, 0);
    group.add(sign);

    return group;
  }

  /**
   * Archetype 2: "The Emerald Arch" (Carlyle/Beacon style — matches screenshot center)
   * Seafoam mint facade, towering neon green/cyan arch framing the facade,
   * stepped ziggurat tower, and illuminated entrance marquee.
   */
  public static createEmeraldArchHotel(widthZ = 20, heightY = 28, depthX = 14): THREE.Group {
    const m = this.getMaterials();
    const group = new THREE.Group();

    // Main mint green building block
    const mainGeo = new THREE.BoxGeometry(depthX, heightY, widthZ);
    const mainMesh = new THREE.Mesh(mainGeo, m.facadeMint);
    mainMesh.position.set(depthX / 2, heightY / 2, 0);
    mainMesh.castShadow = true;
    mainMesh.receiveShadow = true;
    group.add(mainMesh);

    // Symmetrical flanking window planes
    for (const side of [-1, 1]) {
      const winGeo = new THREE.PlaneGeometry(widthZ * 0.32, heightY * 0.55);
      const winMat = new THREE.MeshBasicMaterial({ map: this.getWindowTexture(), toneMapped: false });
      const win = new THREE.Mesh(winGeo, winMat);
      win.rotation.y = -Math.PI / 2;
      win.position.set(-0.02, heightY * 0.55, side * widthZ * 0.28);
      group.add(win);
    }

    // ── Massive Glowing Neon Green/Cyan Arch (Directly from screenshot!) ──
    const archH = 14.0;
    const archW = 6.8;
    const archPts: THREE.Vector3[] = [];
    // Left leg
    archPts.push(new THREE.Vector3(-0.15, 3.5, -archW / 2));
    archPts.push(new THREE.Vector3(-0.15, archH, -archW / 2));
    // Curved top crown
    for (let a = 0; a <= 12; a++) {
      const theta = Math.PI - (a / 12) * Math.PI;
      const z = Math.cos(theta) * (archW / 2);
      const y = archH + Math.sin(theta) * 2.2;
      archPts.push(new THREE.Vector3(-0.15, y, z));
    }
    // Right leg
    archPts.push(new THREE.Vector3(-0.15, archH, archW / 2));
    archPts.push(new THREE.Vector3(-0.15, 3.5, archW / 2));

    const archCurve = new THREE.CatmullRomCurve3(archPts);
    const archGeo = new THREE.TubeGeometry(archCurve, 36, 0.12, 6, false);
    const archMesh = new THREE.Mesh(archGeo, m.neonGreen);
    group.add(archMesh);

    // Inner arch recessed stucco accent
    const innerArchMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.3, archH + 2.0, archW + 0.6),
      m.facadeWhite
    );
    innerArchMesh.position.set(0.1, (archH + 2.0) / 2 + 1.5, 0);
    group.add(innerArchMesh);

    // Ground floor grand entrance
    const entryGeo = new THREE.BoxGeometry(2.4, 0.4, 7.5);
    const entryCanopy = new THREE.Mesh(entryGeo, m.facadeWhite);
    entryCanopy.position.set(-1.2, 4.0, 0);
    group.add(entryCanopy);

    const canopyNeon = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 7.6), m.neonCyan);
    canopyNeon.position.set(-2.45, 4.0, 0);
    group.add(canopyNeon);

    // Stepped tower top with vertical green neon stripes
    const tower = new THREE.Mesh(new THREE.BoxGeometry(depthX * 0.7, 4.5, widthZ * 0.45), m.facadeMint);
    tower.position.set(depthX / 2, heightY + 2.25, 0);
    group.add(tower);

    for (const zOff of [-2.0, 0, 2.0]) {
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.08, 4.2, 0.08), m.neonGreen);
      stripe.position.set(-0.05, heightY + 2.25, zOff);
      group.add(stripe);
    }

    // Rooftop Sign
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(6.8, 1.8),
      new THREE.MeshBasicMaterial({
        map: this.getSignTexture('BEACON', '#39ff14', '#00ff88'),
        transparent: true,
        toneMapped: false,
      })
    );
    sign.rotation.y = -Math.PI / 2;
    sign.position.set(0, heightY + 4.8, 0);
    group.add(sign);

    return group;
  }

  /**
   * Archetype 3: "The Moderne" (Clevelander style)
   * Warm coral peach facade, rounded Streamline Moderne corner tower with curved balconies,
   * electric cyan neon wrap-around railings, and rooftop radio beacon mast.
   */
  public static createModerneHotel(widthZ = 22, heightY = 22, depthX = 14): THREE.Group {
    const m = this.getMaterials();
    const group = new THREE.Group();

    // Main coral block
    const mainGeo = new THREE.BoxGeometry(depthX, heightY, widthZ);
    const main = new THREE.Mesh(mainGeo, m.facadePeach);
    main.position.set(depthX / 2, heightY / 2, 0);
    main.castShadow = true;
    main.receiveShadow = true;
    group.add(main);

    // Window grid
    const win = new THREE.Mesh(
      new THREE.PlaneGeometry(widthZ * 0.75, heightY * 0.6),
      new THREE.MeshBasicMaterial({ map: this.getWindowTexture(), toneMapped: false })
    );
    win.rotation.y = -Math.PI / 2;
    win.position.set(-0.02, heightY * 0.55, widthZ * 0.05);
    group.add(win);

    // Front-left rounded cylindrical corner tower (Streamline Moderne signature)
    const towerRadius = 3.6;
    const cylGeo = new THREE.CylinderGeometry(towerRadius, towerRadius, heightY, 20, 1, false, 0, Math.PI);
    const cyl = new THREE.Mesh(cylGeo, m.facadeWhite);
    cyl.rotation.y = Math.PI / 2;
    cyl.position.set(0, heightY / 2, -widthZ / 2 + towerRadius);
    group.add(cyl);

    // Cantilevered curved balconies with electric cyan neon strip railings
    for (let floor = 1; floor <= 4; floor++) {
      const balcY = floor * 4.2 + 2.0;
      const balcGeo = new THREE.CylinderGeometry(towerRadius + 0.6, towerRadius + 0.6, 0.4, 20, 1, false, 0, Math.PI);
      const balc = new THREE.Mesh(balcGeo, m.facadeWhite);
      balc.rotation.y = Math.PI / 2;
      balc.position.set(0, balcY, -widthZ / 2 + towerRadius);
      group.add(balc);

      // Curved cyan neon railing
      const railGeo = new THREE.TorusGeometry(towerRadius + 0.65, 0.055, 6, 20, Math.PI);
      const rail = new THREE.Mesh(railGeo, m.neonCyan);
      rail.rotation.x = Math.PI / 2;
      rail.rotation.z = Math.PI / 2;
      rail.position.set(0, balcY + 0.4, -widthZ / 2 + towerRadius);
      group.add(rail);
    }

    // Rooftop Art Deco radio antenna mast with glowing beacon
    const mastGeo = new THREE.CylinderGeometry(0.06, 0.14, 7.5, 6);
    const mast = new THREE.Mesh(mastGeo, m.chrome);
    mast.position.set(1.5, heightY + 3.75, 0);
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 12), m.neonPink);
    beacon.position.set(1.5, heightY + 7.5, 0);
    group.add(mast, beacon);

    // Rooftop Sign
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(6.5, 1.8),
      new THREE.MeshBasicMaterial({
        map: this.getSignTexture('VICE', '#00f0ff', '#00bfff'),
        transparent: true,
        toneMapped: false,
      })
    );
    sign.rotation.y = -Math.PI / 2;
    sign.position.set(0, heightY + 2.8, widthZ * 0.15);
    group.add(sign);

    return group;
  }

  /**
   * Archetype 4: "The Sunburst Hotel" (Leslie/Edison style)
   * Pastel yellow facade, triple-tier stepped ziggurat, white window eyebrows,
   * purple and gold neon horizontal stripes.
   */
  public static createSunburstHotel(widthZ = 20, heightY = 26, depthX = 14): THREE.Group {
    const m = this.getMaterials();
    const group = new THREE.Group();

    // Main yellow block
    const main = new THREE.Mesh(new THREE.BoxGeometry(depthX, heightY, widthZ), m.facadeYellow);
    main.position.set(depthX / 2, heightY / 2, 0);
    main.castShadow = true;
    main.receiveShadow = true;
    group.add(main);

    // Navy blue tile ground floor base
    const baseMesh = new THREE.Mesh(new THREE.BoxGeometry(depthX + 0.2, 4.0, widthZ + 0.1), m.facadeNavy);
    baseMesh.position.set((depthX + 0.2) / 2 - 0.1, 2.0, 0);
    group.add(baseMesh);

    // Window grid
    const win = new THREE.Mesh(
      new THREE.PlaneGeometry(widthZ * 0.85, heightY * 0.58),
      new THREE.MeshBasicMaterial({ map: this.getWindowTexture(), toneMapped: false })
    );
    win.rotation.y = -Math.PI / 2;
    win.position.set(-0.02, heightY * 0.58, 0);
    group.add(win);

    // Horizontal white window eyebrows (sunshades) with purple neon underglow
    for (let i = 1; i <= 4; i++) {
      const y = 4.0 + i * 4.2;
      const brow = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.18, widthZ * 0.86), m.facadeWhite);
      brow.position.set(-0.4, y, 0);
      const neon = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, widthZ * 0.86), m.neonPurple);
      neon.position.set(-0.82, y - 0.08, 0);
      group.add(brow, neon);
    }

    // Triple stepped ziggurat crown
    for (let t = 0; t < 3; t++) {
      const wFrac = 0.7 - t * 0.18;
      const tier = new THREE.Mesh(new THREE.BoxGeometry(depthX * 0.7, 1.4, widthZ * wFrac), m.facadeYellow);
      tier.position.set(depthX / 2, heightY + 0.7 + t * 1.4, 0);
      const trim = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, widthZ * wFrac), m.neonYellow);
      trim.position.set(0, heightY + 0.7 + t * 1.4, 0);
      group.add(tier, trim);
    }

    // Rooftop Sign
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(7.2, 1.8),
      new THREE.MeshBasicMaterial({
        map: this.getSignTexture('FLAMINGO', '#ffe600', '#ff9900'),
        transparent: true,
        toneMapped: false,
      })
    );
    sign.rotation.y = -Math.PI / 2;
    sign.position.set(0, heightY + 4.8, 0);
    group.add(sign);

    return group;
  }

  /**
   * Retro 1970s Miami classic cruiser parked along sidewalk curb
   * (Matches the vintage car in the user's screenshot!)
   */
  public static createParkedRetroCar(colorType: 'pink' | 'turquoise' | 'yellow' = 'pink'): THREE.Group {
    const m = this.getMaterials();
    const group = new THREE.Group();

    const paintMat =
      colorType === 'pink' ? m.carPaintPink :
      colorType === 'turquoise' ? m.carPaintTurquoise :
      m.carPaintYellow;

    // Main low-slung cruiser chassis
    const bodyGeo = new THREE.BoxGeometry(1.9, 0.55, 4.8);
    const body = new THREE.Mesh(bodyGeo, paintMat);
    body.position.y = 0.55;
    body.castShadow = true;
    group.add(body);

    // Tapered cabin roof
    const cabinGeo = new THREE.BoxGeometry(1.6, 0.5, 2.4);
    const cabin = new THREE.Mesh(cabinGeo, paintMat);
    cabin.position.set(0, 0.95, -0.2);
    cabin.castShadow = true;
    group.add(cabin);

    // Smoked / chrome windows
    const windowGlass = new THREE.Mesh(
      new THREE.BoxGeometry(1.62, 0.42, 2.3),
      new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.1, metalness: 0.9 })
    );
    windowGlass.position.set(0, 0.95, -0.2);
    group.add(windowGlass);

    // Front chrome grille and bumper
    const bumperGeo = new THREE.BoxGeometry(1.95, 0.18, 0.18);
    const fwdBumper = new THREE.Mesh(bumperGeo, m.chrome);
    fwdBumper.position.set(0, 0.38, 2.45);
    const rearBumper = new THREE.Mesh(bumperGeo, m.chrome);
    rearBumper.position.set(0, 0.38, -2.45);
    group.add(fwdBumper, rearBumper);

    // Dual quad round headlights
    const hlGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.08, 12);
    for (const side of [-0.65, -0.4, 0.4, 0.65]) {
      const hl = new THREE.Mesh(hlGeo, m.glassWarm);
      hl.rotation.x = Math.PI / 2;
      hl.position.set(side, 0.58, 2.42);
      group.add(hl);
    }

    // Rear red taillight strip
    const tlGeo = new THREE.BoxGeometry(1.7, 0.12, 0.06);
    const tl = new THREE.Mesh(tlGeo, new THREE.MeshStandardMaterial({
      color: 0xff0404,
      emissive: 0xff0404,
      emissiveIntensity: 1.5,
    }));
    tl.position.set(0, 0.6, -2.42);
    group.add(tl);

    // 4 Wheels
    const tireGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.22, 16);
    const hubcapGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.24, 12);

    for (const z of [-1.4, 1.4]) {
      for (const side of [-1, 1]) {
        const wheel = new THREE.Group();
        const tire = new THREE.Mesh(tireGeo, m.carTire);
        tire.rotation.z = Math.PI / 2;
        const hub = new THREE.Mesh(hubcapGeo, m.chrome);
        hub.rotation.z = Math.PI / 2;
        wheel.add(tire, hub);
        wheel.position.set(side * 0.95, 0.32, z);
        wheel.castShadow = true;
        group.add(wheel);
      }
    }

    return group;
  }
}
