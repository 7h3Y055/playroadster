/**
 * Engine.ts — Three.js scene, camera, WebGL renderer, lighting, sky dome, fog.
 * Tuned to match the elegant cinematic Miami dusk aesthetic from the reference game.
 * Uses soft twilight tones and linear fog to keep the player from being blinded.
 */
import * as THREE from 'three';

export class Engine {
  public readonly scene: THREE.Scene;
  public readonly camera: THREE.PerspectiveCamera;
  public readonly renderer: THREE.WebGLRenderer;
  public readonly clock: THREE.Clock;

  /** Directional "sunset" light — main shadow caster */
  public readonly sunLight: THREE.DirectionalLight;
  /** Hemisphere sky/ground fill */
  public readonly hemiLight: THREE.HemisphereLight;

  constructor() {
    const container = document.getElementById('stage');
    if (!container) throw new Error('#stage element not found');

    // ── Renderer ──────────────────────────────
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.02;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);

    // ── Scene ─────────────────────────────────
    this.scene = new THREE.Scene();

    // ── Linear Fog — GTA Vice City sunset rose haze (200-900m) ────
    this.scene.fog = new THREE.Fog(0x782f4e, 200, 900);

    // ── Camera — chase cam behind player ──────
    this.camera = new THREE.PerspectiveCamera(
      70,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    this.camera.position.set(0, 4.1, 6.6);
    this.camera.lookAt(0, 2.3, -18);

    // ── Clock ─────────────────────────────────
    this.clock = new THREE.Clock();

    // ── Lighting (GTA Vice City Warm Sunset Palette) ───────────
    this.sunLight = this._createSunLight();
    this.hemiLight = this._createHemisphereLight();
    const ambient = new THREE.AmbientLight(0x642442, 0.65);
    this.scene.add(this.sunLight, this.hemiLight, ambient);

    // ── GTA Vice City Sunset Sky Dome with Sunburst Sun & Ocean Glow ─
    this._createSkyDome();

    // ── Resize handler ────────────────────────
    window.addEventListener('resize', this._onResize);
  }

  // ── GTA Vice City Sunset Sky Dome with Radiant Sunburst Sun over Ocean ───
  private _createSkyDome(): void {
    const skyGeo = new THREE.SphereGeometry(600, 32, 32);
    const skyMat = new THREE.ShaderMaterial({
      uniforms: {
        uTopColor:  { value: new THREE.Color(0x240e3a) }, // Deep sunset purple-indigo zenith
        uMidColor:  { value: new THREE.Color(0xd9386c) }, // Vice City Warm Magenta-Pink
        uBotColor:  { value: new THREE.Color(0xeb8026) }, // Sunburst Gold / Amber horizon
        uSunColor:  { value: new THREE.Color(0xffbf66) }, // Warm golden amber setting sun (soft, non-glaring)
        uSunDir:    { value: new THREE.Vector3(-0.78, 0.16, -0.60).normalize() },
      },
      vertexShader: /* glsl */ `
        varying vec3 vWorldPosition;
        void main() {
          vec4 worldPos = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPos.xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uTopColor;
        uniform vec3 uMidColor;
        uniform vec3 uBotColor;
        uniform vec3 uSunColor;
        uniform vec3 uSunDir;
        varying vec3 vWorldPosition;

        void main() {
          vec3 nPos = normalize(vWorldPosition);
          float h = clamp(nPos.y * 2.2 + 0.15, 0.0, 1.0);

          // Rich two-tier Vice City sunset gradient
          vec3 sky = mix(uBotColor, uMidColor, smoothstep(0.0, 0.45, h));
          sky = mix(sky, uTopColor, smoothstep(0.40, 1.0, h));

          // Soft setting Sun on the left horizon over the ocean (pleasant warmth without blinding glare)
          float sunDot = max(dot(nPos, uSunDir), 0.0);
          float sunDisk = pow(sunDot, 340.0) * 1.5;
          float sunGlow = pow(sunDot, 26.0) * 0.35;
          float sunWide = pow(sunDot, 6.0) * 0.14;
          sky += uSunColor * (sunDisk + sunGlow + sunWide);

          gl_FragColor = vec4(sky, 1.0);
        }
      `,
      side: THREE.BackSide,
      depthWrite: false,
    });
    const skyMesh = new THREE.Mesh(skyGeo, skyMat);
    this.scene.add(skyMesh);
  }

  // ── Directional Golden Sunlight casting crisp sunset shadows from ocean side ──
  private _createSunLight(): THREE.DirectionalLight {
    const sun = new THREE.DirectionalLight(0xffe4a0, 1.65);
    sun.position.set(-65, 32, -80);
    sun.target.position.set(0, 0, -35);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 280;
    sun.shadow.camera.left = -50;
    sun.shadow.camera.right = 50;
    sun.shadow.camera.top = 50;
    sun.shadow.camera.bottom = -20;
    sun.shadow.bias = -0.0004;
    this.scene.add(sun.target);
    return sun;
  }

  // ── Hemisphere Fill Light (warm sunset sky pink, golden sand ground bounce) ──
  private _createHemisphereLight(): THREE.HemisphereLight {
    return new THREE.HemisphereLight(
      0xff8da8,  // Sky: Sunset rose pink
      0x54301e,  // Ground: Warm asphalt / sand bounce
      1.05
    );
  }

  private currentPixelRatio = Math.min(window.devicePixelRatio, 1.5);

  // ── Resize ────────────────────────────────────
  private _onResize = (): void => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(this.currentPixelRatio);
    this.renderer.setSize(w, h);
  };

  /** Dynamically apply Low, Mid, High, Ultra graphics preset */
  public applyGraphicsPreset(preset: {
    pixelRatio: number;
    shadows: boolean;
    shadowMapSize: number;
    shadowType: THREE.ShadowMapType;
  }): void {
    this.currentPixelRatio = preset.pixelRatio;
    this.renderer.setPixelRatio(this.currentPixelRatio);
    this.renderer.setSize(window.innerWidth, window.innerHeight);

    this.renderer.shadowMap.enabled = preset.shadows;
    this.renderer.shadowMap.type = preset.shadowType;
    this.renderer.shadowMap.needsUpdate = true;

    this.sunLight.castShadow = preset.shadows;
    if (preset.shadows) {
      this.sunLight.shadow.mapSize.set(preset.shadowMapSize, preset.shadowMapSize);
      if (this.sunLight.shadow.map) {
        this.sunLight.shadow.map.dispose();
        // @ts-ignore
        this.sunLight.shadow.map = null;
      }
    }
  }

  /** Single render pass (called from GameLoop or EffectComposer) */
  public render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  public dispose(): void {
    window.removeEventListener('resize', this._onResize);
    this.renderer.dispose();
  }
}
