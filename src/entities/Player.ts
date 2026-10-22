/**
 * Player.ts — Roadster player entity with authentic 10-nozzle SpaceX cold-gas thruster system.
 * Faithfully ports the air mechanics, supersonic plumes, Mach shockwave diamonds,
 * air consumption (600 L tank), and stunt physics from https://roadsterdash.com/.
 */
import * as THREE from 'three';
import {
  createRoadsterDashCar,
  type RoadsterDashCarInstance,
} from './RoadsterDashModel';
import {
  ColdGasThrusters,
  type ThrusterId,
  ALL_THRUSTER_IDS,
  REAR_THRUSTERS,
  LIFT_THRUSTERS,
} from '@vfx/ColdGasThrusters';
import type { InputState } from '@core/InputManager';
import type { Updatable } from '@core/GameLoop';

export interface PlayerEvents {
  onPuff?: (dir: number) => void;
  onJump?: () => void;
  onHover?: () => void;
  onBoost?: () => void;
  onSlam?: () => void;
  onLand?: (speed: number) => void;
  onTrick?: (name: string, bonus: number) => void;
  onNoAir?: () => void;
}

export class Player implements Updatable {
  public readonly mesh: THREE.Group;
  private readonly pivot: THREE.Group;
  private readonly carContainer: THREE.Group;
  public readonly roadsterModel: RoadsterDashCarInstance;
  public readonly frontWheels: THREE.Object3D[] = [];
  private readonly wheelSpins: THREE.Object3D[] = [];
  private wingT = 0;

  // ── 10 Cold-Gas Thrusters & Physical Nozzles ──
  public readonly coldGasThrusters: ColdGasThrusters;

  // ── Invulnerability Shield (from Revive / Ad Perk) ──
  public isShielded = false;
  public shieldTimer = 0;

  // ── Air Tank (Roadster Dash SpaceX Package: 600 L) ──
  public air = 600;
  public readonly airCapacity = 600;

  // Air Consumption constants (from Roadster Dash jt)
  public readonly AIR_COST_JUMP = 20;
  public readonly AIR_COST_LANE_SHIFT = 3;
  public readonly AIR_COST_AIR_LANE_SHIFT = 15;
  public readonly AIR_COST_HOVER_PER_SEC = 120;
  public readonly AIR_COST_BOOST_PER_SEC = 40;
  public readonly AIR_COST_SLAM = 20;
  public readonly AIR_COST_TRICK = 40;
  public readonly AIR_RECHARGE_RATE = 70; // L/sec on ground

  // Physics constants (from Roadster Dash St)
  private readonly GRAVITY = 28.0;          // m/s²
  private readonly JUMP_HEIGHT = 2.5;       // m
  private readonly MAX_HEIGHT = 6.2;        // m
  private readonly HOVER_EXTRA_ACCEL = 7.0; // m/s²
  private readonly HOLD_DELAY = 0.28;       // s before hover engages (prevents accidental hover during standard jump)
  private readonly SLAM_SPEED = -22.0;      // m/s downward
  private readonly LANE_SHIFT_TIME = 0.15;  // s with cold-gas side jet
  private readonly LANE_SHIFT_TIME_NO_AIR = 0.35; // s without air assistance

  // ── Lane & Lateral State ────────────────
  public currentLane = 0; // -1: Left, 0: Center, 1: Right
  public readonly laneWidth = 3.5;
  private laneFromX = 0;
  private laneTargetX = 0;
  private laneT = 1.0;
  private laneDuration = 0.15;

  // ── Animation & Physics Spring States (from Roadster Dash) ──
  private lateralYaw = 0;
  private lateralRoll = 0;
  private lateralRollV = 0;
  private susp = 0;
  private suspV = 0;
  private rollSettle = 0;
  private flipSettle = 0;
  private rollTail = 0;
  private flipTail = 0;
  private roll = 0;
  private flip = 0;
  private prevX = 0;
  private prevVx = 0;

  // ── Vertical State ──────────────────────
  public positionY = 0;
  public velocityY = 0;
  public isGrounded = true;
  public isHovering = false;
  private jumpHeld = false;
  private holdTime = 0;

  // ── Boost & Stunt State ─────────────────
  public isBoosting = false;
  public isFlipping = false;
  public isRolling = false;
  private readonly TRICK_DURATION = 0.55; // s default duration

  private trick: {
    type: 'barrel' | 'kickflip';
    dir: number; // +1: roll left, -1: roll right
    acc: number; // 0 to 2*PI in radians
    credited: boolean;
  } | null = null;

  public justCompletedTrick: string | null = null;
  public justLandedSlam = false;

  private inputState: Readonly<InputState> | null = null;
  private prevInputLeft = false;
  private prevInputRight = false;
  private prevInputFly = false;
  private prevInputSlam = false;

  public events: PlayerEvents = {};

  // ── Collision Box ───────────────────────
  public readonly halfExtents = new THREE.Vector3(0.94, 0.55, 2.1);

  constructor(scene: THREE.Scene) {
    this.mesh = new THREE.Group();
    this.mesh.position.set(0, 0, 0);

    // Center of mass rotation pivot (y = 0.55m off ground, exact Roadster Dash pivot)
    this.pivot = new THREE.Group();
    this.pivot.position.y = 0.55;
    this.mesh.add(this.pivot);

    // Car container offset by -0.55m relative to pivot so tires touch ground at y = 0
    this.carContainer = new THREE.Group();
    this.carContainer.position.set(0, -0.55, 0);
    this.pivot.add(this.carContainer);

    // Authentic Roadster Dash procedural Tesla Roadster
    this.roadsterModel = createRoadsterDashCar(0xffffff);
    this.carContainer.add(this.roadsterModel.group);

    // Front steering hubs and rolling wheel spin nodes
    for (const w of this.roadsterModel.wheels) {
      this.wheelSpins.push(w.spin);
      if (w.front) {
        this.frontWheels.push(w.wheel);
      }
    }

    // Initialize 10 cold-gas thruster plumes
    this.coldGasThrusters = new ColdGasThrusters();
    this.carContainer.add(this.coldGasThrusters.group);

    scene.add(this.mesh);
  }

  public setInput(input: Readonly<InputState>): void {
    this.inputState = input;
  }

  /** Spend air if available. Returns true if spent or if free. */
  private _spendAir(amount: number): boolean {
    if (this.air >= amount) {
      this.air = Math.max(0, this.air - amount);
      return true;
    }
    this.events.onNoAir?.();
    return false;
  }

  public update(dt: number): void {
    const input = this.inputState;
    if (!input) return;

    this.justCompletedTrick = null;
    this.justLandedSlam = false;

    // Tick invulnerability shield
    if (this.shieldTimer > 0) {
      this.shieldTimer -= dt;
      this.isShielded = this.shieldTimer > 0;
      // Strobe opacity/visibility during shield
      const strobe = Math.sin(this.shieldTimer * 26) > 0;
      this.mesh.visible = strobe || this.shieldTimer <= 0;
      if (this.shieldTimer <= 0) {
        this.mesh.visible = true;
      }
    }

    // Detect single-press edge triggers
    const leftPressed = input.left && !this.prevInputLeft;
    const rightPressed = input.right && !this.prevInputRight;
    const flyPressed = input.fly && !this.prevInputFly;
    const slamPressed = input.slam && !this.prevInputSlam;

    this.prevInputLeft = input.left;
    this.prevInputRight = input.right;
    this.prevInputFly = input.fly;
    this.prevInputSlam = input.slam;

    // ── 1. Jump, Hover, and Vertical Flight ──
    // Evaluated BEFORE lateral movement so that pressing Space + Left / Space + Right
    // takes off into the jump and immediately initiates an airborne barrel roll!
    if (this.isGrounded) {
      this.jumpHeld = input.fly;
      this.holdTime = 0;
      this.isHovering = false;

      if (flyPressed) {
        this._executeJump();
      }
    } else {
      // In air: detect holding jump for hover
      this.jumpHeld = input.fly;
      if (this.jumpHeld) {
        this.holdTime += dt;
      } else {
        this.holdTime = 0;
      }

      const wantsHover = this.jumpHeld && this.holdTime >= this.HOLD_DELAY;
      if (wantsHover && this.air > 0 && this.velocityY > this.SLAM_SPEED + 1) {
        this.isHovering = true;
        this.air = Math.max(0, this.air - this.AIR_COST_HOVER_PER_SEC * dt);

        let hoverAccel = this.HOVER_EXTRA_ACCEL;
        if (this.velocityY < -2) hoverAccel = 22;
        if (this.positionY >= this.MAX_HEIGHT) {
          hoverAccel = 0;
          this.velocityY = Math.min(0, this.velocityY);
        }

        this.velocityY += hoverAccel * dt;
        this.coldGasThrusters.fireContinuous(LIFT_THRUSTERS, 0.95);

        if (this.air <= 0) {
          this.events.onNoAir?.();
        }
      } else {
        this.isHovering = false;
        this.velocityY -= this.GRAVITY * dt;
      }

      // Stunt: Front flip when pressing Up/Space again in air
      if (flyPressed && !this.trick && this.positionY > 1.0) {
        this._startFrontFlip();
      }

      // Slam: Diving downward at high speed
      if (slamPressed && this.velocityY > this.SLAM_SPEED) {
        this._executeSlam();
      }
    }

    // ── 2. Lateral Movement & Lane Shifts ──
    if (this.isGrounded) {
      if (leftPressed && this.currentLane > -1) {
        this._shiftLane(-1);
      } else if (rightPressed && this.currentLane < 1) {
        this._shiftLane(1);
      }
    } else {
      // In mid-air: triggers authentic left/right barrel roll
      if (leftPressed && this.currentLane > -1) {
        this._startBarrelRoll(-1);
      } else if (rightPressed && this.currentLane < 1) {
        this._startBarrelRoll(1);
      }
    }

    // Snappy polynomial lane interpolation (from Roadster Dash i3(t) = 1 - (1-t)^4 * (1+2t))
    let currentX = this.mesh.position.x;
    if (this.laneT < 1.0) {
      this.laneT = Math.min(1.0, this.laneT + dt / this.laneDuration);
      const t = this.laneT;
      const smooth = 1 - Math.pow(1 - t, 4) * (1 + 2 * t);
      currentX = this.laneFromX + (this.laneTargetX - this.laneFromX) * smooth;
    } else {
      currentX = this.laneTargetX;
    }

    // ── 3. Apply Vertical Physics & Ground Clamp ──
    this.positionY += this.velocityY * dt;

    if (this.positionY <= 0) {
      if (!this.isGrounded) {
        // Landing impact
        const impact = Math.min(1.6, Math.abs(this.velocityY) / 14);
        this.isGrounded = true;
        this.positionY = 0;
        this.velocityY = 0;
        this.isHovering = false;

        // Suspension compression down on landing
        this.suspV = -3.5 * impact;

        const TWO_PI = Math.PI * 2;
        if (this.flipTail > 0) {
          this.flipSettle += this.flipTail;
          this.flipTail = 0;
        }
        if (this.rollTail !== 0) {
          this.rollSettle += this.rollTail;
          this.rollTail = 0;
        }

        // If landed mid-trick, settle the remainder cleanly without jarring snaps!
        if (this.trick) {
          const a = (this.trick.acc * this.trick.dir) % TWO_PI;
          const o = a > Math.PI ? a - TWO_PI : a < -Math.PI ? a + TWO_PI : a;
          if (this.trick.type === 'kickflip') {
            this.flipSettle = o;
          } else {
            this.rollSettle = o;
          }
          this._finishTrick();
        }

        this.events.onLand?.(impact * 14);
      }
      this.positionY = 0;
      this.velocityY = 0;

      // Ground Air Refill
      if (!this.isBoosting) {
        this.air = Math.min(this.airCapacity, this.air + this.AIR_RECHARGE_RATE * dt);
      }
    } else {
      this.isGrounded = false;
    }

    // ── 4. Boost ──
    if (input.boost && this.air > 0) {
      this.isBoosting = true;
      this.air = Math.max(0, this.air - this.AIR_COST_BOOST_PER_SEC * dt);
      this.coldGasThrusters.fireContinuous(REAR_THRUSTERS, 1.0);
      this.events.onBoost?.();

      if (this.air <= 0) {
        this.isBoosting = false;
        this.events.onNoAir?.();
      }
    } else {
      this.isBoosting = false;
    }

    // ── 5. Stunt Animations (Dynamic Air-Time Timed Barrel Roll & Front Flip) ──
    if (this.trick) {
      const TWO_PI = Math.PI * 2;
      let trickSpeed = TWO_PI / (this.trick.type === 'kickflip' ? 0.7 : this.TRICK_DURATION);

      if (!this.isHovering) {
        const v = Math.max(0, this.positionY);
        const g = this.GRAVITY;
        const timeToLand = (this.velocityY + Math.sqrt(this.velocityY * this.velocityY + 2 * g * v)) / g;
        // Dynamically scale trick speed so it completes smoothly right as the car touches down
        trickSpeed = Math.max(trickSpeed, (TWO_PI - this.trick.acc) / Math.max(0.05, timeToLand - 0.06));
      }

      this.trick.acc += trickSpeed * dt;

      if (this.trick.type === 'kickflip') {
        this.coldGasThrusters.fireContinuous(['L3', 'L4'], 0.95);
      } else if (this.trick.type === 'barrel') {
        const liftNozzles: ThrusterId[] = this.trick.dir > 0 ? ['L2', 'L4'] : ['L1', 'L3'];
        this.coldGasThrusters.fireContinuous(liftNozzles, 0.85);
      }

      if (this.trick.acc >= TWO_PI) {
        this._finishTrick();
      }
    }

    // ── 6. Physical Suspension Spring & Center-of-Mass Rotation Integration ──
    const TWO_PI = Math.PI * 2;
    this.suspV += (-this.susp * 160 - this.suspV * 14) * dt;
    this.susp += this.suspV * dt;

    this.rollSettle *= Math.exp(-20 * dt);
    this.flipSettle *= Math.exp(-20 * dt);

    if (this.flipTail > 0) {
      this.flipTail = Math.max(0, this.flipTail - (TWO_PI / 0.7) * 1.2 * dt);
    }
    if (this.rollTail !== 0) {
      const p = (TWO_PI / 0.55) * 1.2 * dt;
      this.rollTail = Math.abs(this.rollTail) <= p ? 0 : this.rollTail - Math.sign(this.rollTail) * p;
    }

    const vx = (currentX - this.prevX) / Math.max(dt, 0.0001);
    const ax = (vx - this.prevVx) / Math.max(dt, 0.0001);

    const inTrick = !!this.trick;
    // Bank yaw smoothly toward lateral travel direction
    const targetYaw = -THREE.MathUtils.clamp(Math.atan2(vx, Math.max(30, 45)) * 0.65, -0.24, 0.24) * (inTrick ? 0.35 : 1.0);
    this.lateralYaw += (targetYaw - this.lateralYaw) * (1 - Math.exp(-28 * dt));

    // Dynamic spring roll into turns
    const targetRoll = inTrick ? 0 : THREE.MathUtils.clamp(ax / 900, -1, 1) * (this.isGrounded ? 0.055 : 0.035);
    const springK = 24;
    const c = this.lateralRoll - targetRoll;
    const h = this.lateralRollV + springK * c;
    const u = Math.exp(-springK * dt);
    this.lateralRoll = targetRoll + (c + h * dt) * u;
    this.lateralRollV = (this.lateralRollV - springK * h * dt) * u;

    this.prevX = currentX;
    this.prevVx = vx;

    const r = this.trick ? this.trick.acc * this.trick.dir : 0;
    const isKickflip = this.trick?.type === 'kickflip';
    this.roll = (isKickflip ? 0 : r) + this.rollSettle + this.rollTail;
    this.flip = (isKickflip ? r : 0) + this.flipSettle + this.flipTail;

    // Ground clearance when flipping (prevents nose/tail clipping during vertical tricks)
    const nCos = Math.cos(this.flip);
    const clearance = Math.max(0, 2.35 * Math.abs(Math.sin(this.flip)) + (nCos >= 0 ? 0.55 : 0.72) * Math.abs(nCos) - 0.55 - this.positionY);

    this.mesh.position.set(currentX, this.positionY + clearance, 0);

    // Aerodynamic flight pitch (nose lifts on ascent, dips on descent)
    const flightPitch = this.isGrounded ? 0 : THREE.MathUtils.clamp(this.velocityY * 0.012, -0.18, 0.14) * Math.min(1.0, this.positionY / 1.2);

    // Pivot rotates directly around vehicle center of mass (0.55m off road)
    this.pivot.rotation.set(flightPitch + this.flip, this.lateralYaw, this.roll + this.lateralRoll);

    // Suspension vertical offset moves car container inside the pivot
    this.carContainer.position.y = -0.55 + this.susp * 0.6;

    // Front wheels steer into turns
    for (const w of this.frontWheels) {
      w.rotation.y = THREE.MathUtils.clamp(this.lateralYaw * 1.4, -0.3, 0.3);
    }

    // ── 7. Update Cold Gas Thrusters & Physical Nozzle Glows ──
    this.coldGasThrusters.update(dt, this.isBoosting ? 65 : 35);

    for (const id of ALL_THRUSTER_IDS) {
      const lvl = this.coldGasThrusters.getNozzleLevel(id);
      this.roadsterModel.setNozzleGlow(id, lvl);
    }

    // ── 8. Update Roadster Dash Active Aero, Diffuser Fans & Taillight ──
    const targetWingT = (this.isBoosting || !this.isGrounded) ? 1.0 : 0.0;
    this.wingT += (targetWingT - this.wingT) * Math.min(1.0, 8.0 * dt);
    this.roadsterModel.setWing(this.wingT);
    this.roadsterModel.updateFans(dt);
    this.roadsterModel.setTaillight(this.isBoosting ? 2.5 : 1.0);

    // ── 9. Wheel Rotation ─────────────────
    if (this.isGrounded) {
      const rollRate = this.isBoosting ? 32.0 : 20.0;
      for (const spin of this.wheelSpins) {
        spin.rotation.x += rollRate * dt;
      }
    }
  }

  /** Complete trick and award bonus */
  private _finishTrick(): void {
    if (!this.trick) return;
    if (!this.trick.credited) {
      this.trick.credited = true;
      const isRoll = this.trick.type === 'barrel';
      const reward = isRoll ? 40 : 10;
      const trickName = isRoll ? 'Barrel roll' : 'Front flip';
      const trickBonus = isRoll ? 500 : 200;

      this.air = Math.min(this.airCapacity, this.air + reward);
      this.justCompletedTrick = trickName;
      this.events.onTrick?.(trickName, trickBonus);
    }
    this.isRolling = false;
    this.isFlipping = false;
    this.trick = null;
  }

  /** Lane shift with cold-gas side jet propulsion */
  private _shiftLane(dir: number): void {
    const nextLane = THREE.MathUtils.clamp(this.currentLane + dir, -1, 1);
    if (nextLane === this.currentLane) return;

    const hasAir = this._spendAir(this.AIR_COST_LANE_SHIFT);
    this.currentLane = nextLane;
    this.laneFromX = this.mesh.position.x;
    this.laneTargetX = this.currentLane * this.laneWidth;
    this.laneT = 0;
    this.laneDuration = hasAir ? this.LANE_SHIFT_TIME : this.LANE_SHIFT_TIME_NO_AIR;

    if (hasAir) {
      // Fire OPPOSITE side nozzle to push car in target direction
      // Moving LEFT (-1) -> Fire S2 (right flank)
      // Moving RIGHT (+1) -> Fire S1 (left flank)
      const nozzleToFire = dir < 0 ? 'S2' : 'S1';
      this.coldGasThrusters.sideJet(nozzleToFire, 0.14);
      this.events.onPuff?.(dir);
    }
  }

  /** Jump with 4 downward lift thrusters */
  private _executeJump(): void {
    const hasAir = this._spendAir(this.AIR_COST_JUMP);
    this.velocityY = Math.sqrt(2 * this.GRAVITY * this.JUMP_HEIGHT); // 11.83 m/s
    this.isGrounded = false;
    this.holdTime = 0;

    if (hasAir) {
      this.coldGasThrusters.fire(LIFT_THRUSTERS, 1.0, 9.0);
    }
    this.events.onJump?.();
  }

  /** Mid-air front flip stunt (matches Roadster Dash kickflip) */
  private _startFrontFlip(): void {
    if (this.trick) return;
    if (!this._spendAir(this.AIR_COST_TRICK)) return;

    this.trick = {
      type: 'kickflip',
      dir: 1,
      acc: 0,
      credited: false,
    };
    this.isFlipping = true;
    const lift = Math.sqrt(2 * this.GRAVITY * 0.55 * Math.max(0, 5.0 - this.positionY));
    this.velocityY = Math.max(this.velocityY, lift, 2.5);
    this.coldGasThrusters.fire(['L3', 'L4'], 1.0, 8.5);
  }

  /** Mid-air barrel roll stunt (matches Roadster Dash barrelRoll) */
  private _startBarrelRoll(dir: number): void {
    const TWO_PI = Math.PI * 2;
    if (this.trick?.type === 'kickflip' && this.trick.acc >= TWO_PI * 0.8) {
      this.flipTail = Math.max(0, TWO_PI - this.trick.acc);
      this._finishTrick();
    }

    const nextLane = THREE.MathUtils.clamp(this.currentLane + dir, -1, 1);
    const hasAir = this._spendAir(this.AIR_COST_AIR_LANE_SHIFT);

    if (nextLane !== this.currentLane) {
      this.currentLane = nextLane;
      this.laneFromX = this.mesh.position.x;
      this.laneTargetX = this.currentLane * this.laneWidth;
      this.laneT = 0;
      this.laneDuration = hasAir ? 0.32 : this.LANE_SHIFT_TIME_NO_AIR;
    }

    if (this.trick) {
      if (hasAir) {
        this.coldGasThrusters.sideJet(dir < 0 ? 'S2' : 'S1', 0.16);
      }
      return;
    }

    const hasTrickAir = this._spendAir(this.AIR_COST_TRICK);
    // In Roadster Dash: dir = -e.
    // When moving LEFT (dir < 0): rollDir = +1 (counter-clockwise roll to the left)
    // When moving RIGHT (dir > 0): rollDir = -1 (clockwise roll to the right)
    const rollDir = -dir;

    this.trick = {
      type: 'barrel',
      dir: rollDir,
      acc: 0,
      credited: false,
    };
    this.isRolling = true;

    if (hasTrickAir) {
      // Fire lift nozzles on the outer side to tilt car into the roll,
      // and side jet to thrust into target lane:
      // Moving LEFT (dir < 0): fire right lift nozzles (L2, L4) to lift right side, fire S2 (right flank) to thrust left.
      // Moving RIGHT (dir > 0): fire left lift nozzles (L1, L3) to lift left side, fire S1 (left flank) to thrust right.
      const sideNozzle: ThrusterId = dir < 0 ? 'S2' : 'S1';
      const liftNozzles: ThrusterId[] = dir < 0 ? ['L2', 'L4'] : ['L1', 'L3'];
      this.coldGasThrusters.sideJet(sideNozzle, 0.22);
      this.coldGasThrusters.fire(liftNozzles, 1.0, 7.5);
    }
  }

  /** Downward slam dive */
  private _executeSlam(): void {
    this._spendAir(this.AIR_COST_SLAM);
    this.velocityY = this.SLAM_SPEED; // -22 m/s
    this.isHovering = false;
    this.jumpHeld = false;
    this.events.onSlam?.();
  }

  /** Get world-space bounding box for AABB collision */
  public getAABB() {
    const p = this.mesh.position;
    return {
      minX: p.x - this.halfExtents.x,
      maxX: p.x + this.halfExtents.x,
      minY: p.y,
      maxY: p.y + this.halfExtents.y * 2,
      minZ: p.z - this.halfExtents.z,
      maxZ: p.z + this.halfExtents.z,
    };
  }

  /** Set custom car body paint finish */
  public setFinish(style: 'pearl-white' | 'midnight-carbon' | 'miami-vice'): void {
    const finishes = {
      'pearl-white':     { color: 0xffffff, metalness: 0.08, roughness: 0.28, clearcoat: 1.0, clearcoatRoughness: 0.05 },
      'midnight-carbon': { color: 0x16181f, metalness: 0.85, roughness: 0.22, clearcoat: 0.7, clearcoatRoughness: 0.10 },
      'miami-vice':      { color: 0x0bd3d3, metalness: 0.35, roughness: 0.18, clearcoat: 1.0, clearcoatRoughness: 0.02 },
    };
    const f = finishes[style] ?? finishes['pearl-white'];
    const bodyMat = this.roadsterModel.materials.body as THREE.MeshPhysicalMaterial;
    const wingMat = this.roadsterModel.materials.wing as THREE.MeshPhysicalMaterial;
    if (bodyMat) {
      bodyMat.color.setHex(f.color);
      bodyMat.metalness = f.metalness;
      bodyMat.roughness = f.roughness;
      bodyMat.clearcoat = f.clearcoat;
      bodyMat.clearcoatRoughness = f.clearcoatRoughness;
    }
    if (wingMat) {
      wingMat.color.setHex(f.color);
      wingMat.metalness = f.metalness;
      wingMat.roughness = f.roughness;
      wingMat.clearcoat = f.clearcoat;
      wingMat.clearcoatRoughness = f.clearcoatRoughness;
    }
  }

  public reset(): void {
    this.currentLane = 0;
    this.laneFromX = 0;
    this.laneTargetX = 0;
    this.laneT = 1.0;
    this.positionY = 0;
    this.velocityY = 0;
    this.air = this.airCapacity;
    this.isGrounded = true;
    this.isHovering = false;
    this.isBoosting = false;
    this.isFlipping = false;
    this.isRolling = false;
    this.trick = null;
    this.wingT = 0;
    this.roadsterModel.setWing(0);
    this.lateralYaw = 0;
    this.lateralRoll = 0;
    this.lateralRollV = 0;
    this.susp = 0;
    this.suspV = 0;
    this.rollSettle = 0;
    this.flipSettle = 0;
    this.rollTail = 0;
    this.flipTail = 0;
    this.roll = 0;
    this.flip = 0;
    this.prevX = 0;
    this.mesh.position.set(0, 0, 0);
    this.mesh.rotation.set(0, 0, 0);
    this.pivot.rotation.set(0, 0, 0);
    this.carContainer.position.set(0, -0.55, 0);
    this.carContainer.rotation.set(0, 0, 0);
    this.coldGasThrusters.reset();
    for (const w of this.frontWheels) {
      w.rotation.y = 0;
    }
  }

  /** Revive player car on road after rewarded ad */
  public revive(): void {
    this.currentLane = 0;
    this.laneFromX = 0;
    this.laneTargetX = 0;
    this.laneT = 1.0;
    this.positionY = 0;
    this.velocityY = 0;
    this.air = this.airCapacity;
    this.isGrounded = true;
    this.isHovering = false;
    this.isBoosting = false;
    this.isFlipping = false;
    this.isRolling = false;
    this.trick = null;
    this.wingT = 0;
    this.roadsterModel.setWing(0);
    this.lateralYaw = 0;
    this.lateralRoll = 0;
    this.lateralRollV = 0;
    this.susp = 0;
    this.suspV = 0;
    this.rollSettle = 0;
    this.flipSettle = 0;
    this.rollTail = 0;
    this.flipTail = 0;
    this.roll = 0;
    this.flip = 0;
    this.prevX = 0;
    this.mesh.position.x = 0;
    this.mesh.position.y = 0;
    this.mesh.rotation.set(0, 0, 0);
    this.pivot.rotation.set(0, 0, 0);
    this.carContainer.position.set(0, -0.55, 0);
    this.carContainer.rotation.set(0, 0, 0);
    this.coldGasThrusters.reset();
    for (const w of this.frontWheels) {
      w.rotation.y = 0;
    }
    // Grant 3.5-second invulnerability shield
    this.isShielded = true;
    this.shieldTimer = 3.5;
    this.mesh.visible = true;
  }
}

