/**
 * TrafficCar.ts — Intelligent civilian traffic with realistic driving behaviors,
 * lane changes with amber turn signals, dynamic LED brake lights, front wheel steering,
 * inter-NPC collision avoidance (no clipping), and player near-miss reactions.
 */
import * as THREE from 'three';
import {
  TrafficModelLoader,
  type TrafficModelType,
  TRAFFIC_MODEL_TYPES,
  type ClonedCarInstance,
} from '@utils/TrafficModelLoader';

export type TrafficType = TrafficModelType;

export type DriverPersonality = 'cruiser' | 'speeder' | 'cautious' | 'swerving_taxi';
export type LaneChangeState = 'cruising' | 'signaling' | 'changing';

export class TrafficCar {
  public readonly mesh: THREE.Group;
  public readonly chassis: THREE.Group;
  public active = false;

  // ── Lane & Lateral Position ───────────
  public lane = 0;              // -1, 0, 1
  public targetLane = 0;        // Destination lane during change
  public currentX = 0;
  public laneState: LaneChangeState = 'cruising';

  // ── Driving Parameters ────────────────
  public personality: DriverPersonality = 'cruiser';
  public baseSpeed = 26;        // Cruising speed in m/s (forward relative to road)
  public currentSpeed = 26;     // Smoothed current forward speed
  public targetSpeed = 26;      // Dynamically adapted based on radar
  public isBraking = false;
  public nearMissed = false;

  // ── Timers ────────────────────────────
  private laneTimer = 0;        // Signaling / changing progress
  private laneCooldown = 4;     // Cooldown before next lane change
  private signalDuration = 0.8; // Seconds of amber blinker warning before turning
  private changeDuration = 0.85;// Seconds to cross lanes
  private fromX = 0;
  private toX = 0;
  private blinkerTimer = 0;

  // ── Vehicle Dynamics ──────────────────
  private pitch = 0;
  private yaw = 0;
  private roll = 0;
  private steerAngle = 0;
  private startleWobble = 0;

  // ── AABB half-extents ─────────────────
  public halfW = 0.94;
  public halfH = 0.72;
  public halfL = 1.60;

  // ── 3D Model & Lights ─────────────────
  private readonly modelCache = new Map<TrafficType, ClonedCarInstance>();
  private activeInstance: ClonedCarInstance | null = null;
  public type: TrafficType = 'sedan';

  // Lights Group & Materials
  private readonly lightsGroup: THREE.Group;
  private readonly tailMat: THREE.MeshStandardMaterial;
  private readonly leftBlinkerMat: THREE.MeshStandardMaterial;
  private readonly rightBlinkerMat: THREE.MeshStandardMaterial;
  private readonly headlightMat: THREE.MeshStandardMaterial;

  private rearTaillightMesh!: THREE.Mesh;
  private rearLeftBlinkerMesh!: THREE.Mesh;
  private rearRightBlinkerMesh!: THREE.Mesh;
  private frontLeftBlinkerMesh!: THREE.Mesh;
  private frontRightBlinkerMesh!: THREE.Mesh;
  private frontHeadlightsMesh!: THREE.Mesh;

  // ── Procedural Fallback Mesh ──────────
  private readonly fallbackGroup: THREE.Group;
  private readonly fallbackBody: THREE.Mesh;
  private readonly fallbackRoof: THREE.Mesh;

  // ── Audio callback ────────────────────
  public onHorn?: (pan: number) => void;

  constructor() {
    this.mesh = new THREE.Group();
    this.chassis = new THREE.Group();
    this.mesh.add(this.chassis);

    // ── Setup Dynamic Automotive Lighting ─
    this.lightsGroup = new THREE.Group();

    this.tailMat = new THREE.MeshStandardMaterial({
      color: 0xff1020,
      emissive: 0xd41628,
      emissiveIntensity: 1.3,
      roughness: 0.2,
      metalness: 0.1,
    });

    this.leftBlinkerMat = new THREE.MeshStandardMaterial({
      color: 0xffaa00,
      emissive: 0xff9900,
      emissiveIntensity: 0.0,
      roughness: 0.2,
    });

    this.rightBlinkerMat = new THREE.MeshStandardMaterial({
      color: 0xffaa00,
      emissive: 0xff9900,
      emissiveIntensity: 0.0,
      roughness: 0.2,
    });

    this.headlightMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xfffae0,
      emissiveIntensity: 2.2,
      roughness: 0.1,
    });

    this._createLightsGeometry();
    this.chassis.add(this.lightsGroup);

    // ── Procedural Fallback Setup ─────────
    this.fallbackGroup = new THREE.Group();

    const bodyGeo = new THREE.BoxGeometry(1.8, 0.7, 3.6);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x3d6699,
      roughness: 0.3,
      metalness: 0.2,
    });
    this.fallbackBody = new THREE.Mesh(bodyGeo, bodyMat);
    this.fallbackBody.position.y = 0.5;
    this.fallbackBody.castShadow = true;
    this.fallbackGroup.add(this.fallbackBody);

    const roofGeo = new THREE.BoxGeometry(1.5, 0.55, 1.9);
    const roofMat = new THREE.MeshStandardMaterial({
      color: 0x1a2028,
      roughness: 0.2,
      metalness: 0.8,
    });
    this.fallbackRoof = new THREE.Mesh(roofGeo, roofMat);
    this.fallbackRoof.position.set(0, 1.0, -0.1);
    this.fallbackRoof.castShadow = true;
    this.fallbackGroup.add(this.fallbackRoof);

    this.chassis.add(this.fallbackGroup);
    this.mesh.visible = false;
  }

  /** Build lighting meshes sized to half-extents */
  private _createLightsGeometry(): void {
    // Rear taillights strip (+Z is rear in chassis space)
    const tailGeo = new THREE.BoxGeometry(1.4, 0.09, 0.06);
    this.rearTaillightMesh = new THREE.Mesh(tailGeo, this.tailMat);
    this.rearTaillightMesh.position.set(0, 0.55, 1.6);
    this.lightsGroup.add(this.rearTaillightMesh);

    // Rear left & right amber blinkers
    const blinkerGeo = new THREE.BoxGeometry(0.24, 0.09, 0.07);
    this.rearLeftBlinkerMesh = new THREE.Mesh(blinkerGeo, this.leftBlinkerMat);
    this.rearLeftBlinkerMesh.position.set(-0.78, 0.55, 1.6);
    this.lightsGroup.add(this.rearLeftBlinkerMesh);

    this.rearRightBlinkerMesh = new THREE.Mesh(blinkerGeo, this.rightBlinkerMat);
    this.rearRightBlinkerMesh.position.set(0.78, 0.55, 1.6);
    this.lightsGroup.add(this.rearRightBlinkerMesh);

    // Front headlights (-Z is front in chassis space)
    const headGeo = new THREE.BoxGeometry(1.4, 0.10, 0.06);
    this.frontHeadlightsMesh = new THREE.Mesh(headGeo, this.headlightMat);
    this.frontHeadlightsMesh.position.set(0, 0.52, -1.6);
    this.lightsGroup.add(this.frontHeadlightsMesh);

    // Front amber blinkers
    this.frontLeftBlinkerMesh = new THREE.Mesh(blinkerGeo, this.leftBlinkerMat);
    this.frontLeftBlinkerMesh.position.set(-0.78, 0.52, -1.6);
    this.lightsGroup.add(this.frontLeftBlinkerMesh);

    this.frontRightBlinkerMesh = new THREE.Mesh(blinkerGeo, this.rightBlinkerMat);
    this.frontRightBlinkerMesh.position.set(0.78, 0.52, -1.6);
    this.lightsGroup.add(this.frontRightBlinkerMesh);
  }

  /** Update light positions when model dimensions change */
  private _updateLightPositions(): void {
    const yRear = this.halfH * 0.72;
    const yFront = this.halfH * 0.65;
    const zRear = this.halfL * 0.98;
    const zFront = -this.halfL * 0.98;
    const xEdge = this.halfW * 0.82;

    this.rearTaillightMesh.position.set(0, yRear, zRear);
    this.rearTaillightMesh.scale.set(this.halfW * 1.4, 1, 1);

    this.rearLeftBlinkerMesh.position.set(-xEdge, yRear, zRear);
    this.rearRightBlinkerMesh.position.set(xEdge, yRear, zRear);

    this.frontHeadlightsMesh.position.set(0, yFront, zFront);
    this.frontHeadlightsMesh.scale.set(this.halfW * 1.4, 1, 1);

    this.frontLeftBlinkerMesh.position.set(-xEdge, yFront, zFront);
    this.frontRightBlinkerMesh.position.set(xEdge, yFront, zFront);
  }

  /** Configure this car as a specific normal car type and place it */
  public configure(
    type: TrafficType,
    lane: number,
    z: number,
    personality?: DriverPersonality,
    targetSpeedOffset = 0
  ): void {
    this.type = type;
    this.lane = lane;
    this.targetLane = lane;
    this.currentX = lane * 3.5;
    this.laneState = 'cruising';
    this.laneTimer = 0;
    this.laneCooldown = 3.5 + Math.random() * 4.5;
    this.blinkerTimer = 0;
    this.pitch = 0;
    this.yaw = 0;
    this.roll = 0;
    this.steerAngle = 0;
    this.startleWobble = 0;
    this.isBraking = false;
    this.nearMissed = false;

    // Pick personality if not provided
    if (personality) {
      this.personality = personality;
    } else {
      if (type === 'taxi') {
        this.personality = Math.random() < 0.75 ? 'swerving_taxi' : 'speeder';
      } else if (type === 'sedan-sports') {
        this.personality = Math.random() < 0.8 ? 'speeder' : 'cruiser';
      } else if (type === 'delivery' || type === 'van') {
        this.personality = Math.random() < 0.75 ? 'cautious' : 'cruiser';
      } else {
        const r = Math.random();
        if (r < 0.65) this.personality = 'cruiser';
        else if (r < 0.85) this.personality = 'cautious';
        else this.personality = 'speeder';
      }
    }

    // Assign base forward driving speed (m/s)
    let speed = 25;
    switch (this.personality) {
      case 'speeder':
        speed = 31 + Math.random() * 4.5; // Fast overtaker
        break;
      case 'swerving_taxi':
        speed = 27 + Math.random() * 4.0; // Impatient Miami cab
        break;
      case 'cruiser':
        speed = 24 + Math.random() * 3.0; // Normal highway traffic
        break;
      case 'cautious':
        speed = 19 + Math.random() * 3.0; // Leisurely truck/van
        break;
    }

    // Lane bias: left lane is slightly faster (+2m/s), right lane slightly slower (-2m/s)
    if (lane === -1) speed += 1.8;
    else if (lane === 1) speed -= 1.8;

    this.baseSpeed = Math.max(18, speed + targetSpeedOffset);
    this.currentSpeed = this.baseSpeed;
    this.targetSpeed = this.baseSpeed;

    // Check if 3D model is loaded
    let instance = this.modelCache.get(type);
    if (!instance && TrafficModelLoader.isLoaded()) {
      const cloned = TrafficModelLoader.cloneCar(type);
      if (cloned) {
        this.modelCache.set(type, cloned);
        this.chassis.add(cloned.group);
        instance = cloned;
      }
    }

    // Hide any previous active model
    if (this.activeInstance && this.activeInstance !== instance) {
      this.activeInstance.group.visible = false;
    }

    if (instance) {
      this.activeInstance = instance;
      instance.group.visible = true;
      this.fallbackGroup.visible = false;

      this.halfW = instance.halfW;
      this.halfH = instance.halfH;
      this.halfL = instance.halfL;
    } else {
      // Fallback procedural car
      this.activeInstance = null;
      this.fallbackGroup.visible = true;

      const fallbackColors: Record<TrafficType, number> = {
        'sedan': 0x3d6699,
        'suv': 0x487355,
        'van': 0x9099a2,
        'taxi': 0xe6b800,
        'sedan-sports': 0xa83232,
        'delivery': 0x2e4057,
        'hatchback': 0x2e8b57,
      };
      (this.fallbackBody.material as THREE.MeshStandardMaterial).color.setHex(fallbackColors[type] ?? 0x555555);
      this.halfW = 0.9;
      this.halfH = 0.7;
      this.halfL = 1.8;
    }

    this._updateLightPositions();

    // ── Position & Activate ───────────────
    this.mesh.position.set(this.currentX, 0, z);
    this.chassis.rotation.set(0, 0, 0);
    this.mesh.visible = true;
    this.active = true;
  }

  /**
   * Main intelligent update per frame:
   * - Scans surrounding NPC cars and player
   * - Decelerates smoothly with brake lights if blocked
   * - Signals with flashing amber indicators and executes lane changes
   * - Adjusts suspension pitch, roll, and front wheel steering
   */
  public update(
    dt: number,
    worldMoveDelta: number,
    activeCars: TrafficCar[],
    playerZ = 0,
    playerX = 0
  ): void {
    if (!this.active) return;

    this.blinkerTimer += dt;

    // ── 1. Radar: Scan for vehicle directly ahead in same/target lane ──
    const effectiveLane = this.laneState === 'changing' ? this.targetLane : this.lane;
    let closestCarAhead: TrafficCar | null = null;
    let closestDistanceAhead = Infinity;

    for (const other of activeCars) {
      if (other === this || !other.active) continue;

      // Other car must be ahead (negative Z is forward in world)
      const isAhead = other.mesh.position.z < this.mesh.position.z;
      if (!isAhead) continue;

      // In current or target lane?
      const inLane = other.lane === effectiveLane || other.targetLane === effectiveLane;
      const inX = Math.abs(other.mesh.position.x - this.mesh.position.x) < 2.4;

      if (inLane || inX) {
        const gap = this.mesh.position.z - other.mesh.position.z;
        if (gap < closestDistanceAhead) {
          closestDistanceAhead = gap;
          closestCarAhead = other;
        }
      }
    }

    // ── 2. Speed Adaptation & Braking ─────
    const safeGap = 13 + this.currentSpeed * 0.32; // ~20-25m dynamic following buffer

    if (closestCarAhead && closestDistanceAhead < safeGap) {
      // Vehicle ahead is too close!
      if (closestDistanceAhead < 8.0) {
        // Emergency deceleration to prevent clipping!
        this.targetSpeed = Math.max(10, closestCarAhead.currentSpeed - 6);
        this.isBraking = true;
      } else {
        // Match speed with comfortable cushion
        this.targetSpeed = Math.min(this.baseSpeed, closestCarAhead.currentSpeed - 1.2);
        this.isBraking = this.currentSpeed > this.targetSpeed + 1.0;
      }
    } else {
      // Clear highway ahead: drive at base cruising speed
      this.targetSpeed = this.baseSpeed;
      this.isBraking = false;
    }

    // ── 3. Lane Changing AI Decision ──────
    if (this.laneState === 'cruising') {
      this.laneCooldown -= dt;

      // Trigger 1: Stuck behind a slower car
      const stuckBehindSlow =
        closestCarAhead !== null &&
        closestDistanceAhead < safeGap &&
        closestCarAhead.currentSpeed < this.baseSpeed - 2.0;

      // Trigger 2: Impatient / Swerving personality wanting to overtake
      const wantsOvertake =
        (this.personality === 'speeder' || this.personality === 'swerving_taxi') &&
        Math.random() < (this.personality === 'swerving_taxi' ? 0.30 : 0.18) * dt;

      if (this.laneCooldown <= 0 && (stuckBehindSlow || wantsOvertake)) {
        this._evaluateLaneChange(activeCars, playerZ, playerX);
      }
    }

    // ── 4. Lane Change Execution ──────────
    if (this.laneState === 'signaling') {
      this.laneTimer += dt;
      if (this.laneTimer >= this.signalDuration) {
        // Transition from warning blinker to actual movement
        this.laneState = 'changing';
        this.laneTimer = 0;
        this.fromX = this.mesh.position.x;
        this.toX = this.targetLane * 3.5;
      }
    } else if (this.laneState === 'changing') {
      this.laneTimer += dt;
      const progress = Math.min(1.0, this.laneTimer / this.changeDuration);

      // Smooth cosine easing
      const ease = 0.5 - 0.5 * Math.cos(Math.PI * progress);
      this.currentX = this.fromX + (this.toX - this.fromX) * ease;
      this.mesh.position.x = this.currentX;

      const direction = Math.sign(this.toX - this.fromX);
      const curve = Math.sin(Math.PI * progress);

      // Dynamic chassis yaw into turn and body roll
      this.yaw = direction * curve * 0.11;
      this.roll = -direction * curve * 0.032;
      this.steerAngle = direction * curve * 0.22;

      if (progress >= 1.0) {
        // Lane change finished!
        this.lane = this.targetLane;
        this.mesh.position.x = this.toX;
        this.currentX = this.toX;
        this.laneState = 'cruising';
        this.yaw = 0;
        this.roll = 0;
        this.steerAngle = 0;
        this.laneCooldown = 4.0 + Math.random() * 5.0;
      }
    } else {
      // Cruising straight
      this.currentX = this.lane * 3.5;
      this.mesh.position.x = this.currentX;
      this.yaw *= Math.exp(-6 * dt);
      this.roll *= Math.exp(-6 * dt);
      this.steerAngle *= Math.exp(-6 * dt);
    }

    // Startle recovery wobble (from close player near-miss)
    if (this.startleWobble > 0.001) {
      this.roll += Math.sin(this.blinkerTimer * 24) * this.startleWobble;
      this.startleWobble *= Math.exp(-4 * dt);
    }

    // ── 5. Speed Smoothing & Forward Motion ─
    const speedLerp = this.isBraking ? 4.2 : 2.2;
    this.currentSpeed += (this.targetSpeed - this.currentSpeed) * Math.min(1.0, speedLerp * dt);

    // Chassis pitch: nose-dive on braking, squat on acceleration
    let targetPitch = 0;
    if (this.isBraking) {
      targetPitch = -0.026;
    } else if (this.currentSpeed < this.targetSpeed - 1.5) {
      targetPitch = 0.014;
    }
    this.pitch += (targetPitch - this.pitch) * Math.min(1.0, 5.0 * dt);

    // Forward Z advancement in camera-relative coordinate space
    const netMove = worldMoveDelta - this.currentSpeed * dt;
    this.mesh.position.z += netMove;

    // Apply chassis rotation
    this.chassis.rotation.set(this.pitch, this.yaw, this.roll);

    // ── 6. Wheel Animation ────────────────
    if (this.activeInstance) {
      // Wheel roll proportional to vehicle's actual forward travel speed
      const rollDelta = (this.currentSpeed * dt) / 0.35;
      for (const w of this.activeInstance.wheels) {
        w.rotation.x += rollDelta;
      }

      // Front wheel steering
      for (const fw of this.activeInstance.frontWheels) {
        // Front wheels rotate around Y to steer into turn
        fw.rotation.y = this.steerAngle;
      }
    }

    // ── 7. Lighting & Indicators Update ───
    this._updateLightsVisuals();
  }

  /** Look for a safe adjacent lane to switch into */
  private _evaluateLaneChange(
    activeCars: TrafficCar[],
    playerZ: number,
    playerX: number
  ): void {
    // Possible target lanes
    const candidates: number[] = [];
    if (this.lane === -1) candidates.push(0);
    else if (this.lane === 1) candidates.push(0);
    else if (this.lane === 0) candidates.push(-1, 1);

    // Shuffle candidate order so center lane drivers can pick either left or right
    if (candidates.length > 1 && Math.random() < 0.5) {
      candidates.reverse();
    }

    for (const candLane of candidates) {
      if (this._isLaneSafeToEnter(candLane, activeCars, playerZ, playerX)) {
        // Commit to lane change: begin signaling warning phase!
        this.targetLane = candLane;
        this.laneState = 'signaling';
        this.laneTimer = 0;
        this.signalDuration = this.personality === 'speeder' ? 0.65 : 0.95;
        this.changeDuration = this.personality === 'speeder' ? 0.75 : 0.90;
        return;
      }
    }
  }

  /** Verify that a target lane has adequate clearance */
  private _isLaneSafeToEnter(
    candLane: number,
    activeCars: TrafficCar[],
    playerZ: number,
    playerX: number
  ): boolean {
    const myZ = this.mesh.position.z;

    // Check surrounding traffic cars in target lane
    for (const other of activeCars) {
      if (other === this || !other.active) continue;

      const inCand = other.lane === candLane || other.targetLane === candLane;
      if (!inCand) continue;

      const dz = other.mesh.position.z - myZ;
      // Front buffer: at least 18m ahead; Rear buffer: at least 14m behind
      if (dz > -18 && dz < 14) {
        return false;
      }
    }

    // Check player: don't cut off player if player is nearby in that lane!
    const candX = candLane * 3.5;
    const playerInTargetLane = Math.abs(playerX - candX) < 2.0;
    const playerDistZ = Math.abs(myZ - playerZ);

    if (playerInTargetLane && playerDistZ < 22) {
      return false; // Yield to high-speed player!
    }

    return true;
  }

  /** Update LED brake light intensity and flashing amber indicators */
  private _updateLightsVisuals(): void {
    // Taillight / Brake light
    if (this.isBraking) {
      this.tailMat.emissiveIntensity = 4.8;
      this.tailMat.emissive.setHex(0xff0820);
    } else {
      this.tailMat.emissiveIntensity = 1.35;
      this.tailMat.emissive.setHex(0xd41628);
    }

    // Turn Signals (amber blinkers flashing at 4Hz = 0.25s period)
    const isSignalingOrChanging = this.laneState === 'signaling' || this.laneState === 'changing';
    const isLeft = isSignalingOrChanging && this.targetLane < this.lane;
    const isRight = isSignalingOrChanging && this.targetLane > this.lane;

    const blinkPhase = Math.floor(this.blinkerTimer * 8) % 2 === 0;

    const leftOn = isLeft && blinkPhase;
    const rightOn = isRight && blinkPhase;

    this.leftBlinkerMat.emissiveIntensity = leftOn ? 4.2 : 0.0;
    this.rightBlinkerMat.emissiveIntensity = rightOn ? 4.2 : 0.0;
  }

  /** Trigger subtle startled reaction when player skims past with near-miss */
  public reactToPlayerNearMiss(): void {
    this.startleWobble = 0.045;
    // Tap brakes briefly
    this.isBraking = true;
    this.currentSpeed = Math.max(16, this.currentSpeed - 2.5);

    // Audio horn callback
    const pan = this.mesh.position.x / 5;
    if (Math.random() < 0.45) {
      this.onHorn?.(pan);
    }
  }

  /** Legacy advance call for backwards compatibility */
  public advance(worldMoveDelta: number): void {
    if (!this.active) return;
    const netMove = worldMoveDelta - this.currentSpeed * (1 / 60);
    this.mesh.position.z += netMove;
  }

  /** Get world-space AABB for analytical collision detection */
  public getAABB() {
    const p = this.mesh.position;
    return {
      minX: p.x - this.halfW,
      maxX: p.x + this.halfW,
      minY: p.y,
      maxY: p.y + this.halfH * 2,
      minZ: p.z - this.halfL,
      maxZ: p.z + this.halfL,
    };
  }

  /** Deactivate and hide this car (return to pool) */
  public deactivate(): void {
    this.active = false;
    this.nearMissed = false;
    this.mesh.visible = false;
    this.mesh.position.set(0, -100, 0);
  }

  /** Pick a random traffic type */
  public static randomType(): TrafficType {
    return TRAFFIC_MODEL_TYPES[Math.floor(Math.random() * TRAFFIC_MODEL_TYPES.length)]!;
  }
}
