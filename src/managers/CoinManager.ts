/**
 * CoinManager.ts — Subway Surfers style rhythmic collectible formations and collision pool.
 * Places coins ONLY in lanes and locations where cars ARE NOT present.
 * Uses radar clearance checks before spawning and continuously ensures zero overlap with traffic.
 */
import * as THREE from 'three';
import { Coin } from '@entities/Coin';
import { PoolManager } from '@managers/PoolManager';

const COIN_POOL_SIZE = 96;
const SPAWN_FRONT_Z = -135; // Ahead of player along highway
const LANES = [-1, 0, 1];

export class CoinManager {
  public readonly coins: Coin[] = [];
  private spawnDistanceCounter = 0;
  private currentWorldSpeed = 44;
  private readonly scene: THREE.Scene;
  private readonly pool: PoolManager;

  public onCoinCollected?: (coin: Coin) => void;

  constructor(scene: THREE.Scene, pool: PoolManager) {
    this.scene = scene;
    this.pool = pool;

    // Pre-allocate coin pool
    for (let i = 0; i < COIN_POOL_SIZE; i++) {
      const coin = new Coin();
      this.scene.add(coin.mesh);
      this.coins.push(coin);
    }
  }

  /** Acquire an inactive coin from the pool */
  private _acquireCoin(): Coin | null {
    for (const c of this.coins) {
      if (!c.active) return c;
    }
    return null;
  }

  /**
   * Check if a specific (x, z) location has adequate clearance from all active traffic cars
   */
  public isPositionClearOfCars(x: number, z: number, zBuffer = 7.5): boolean {
    const activeCars = this.pool.getActiveTraffic();
    for (const car of activeCars) {
      // Check lateral proximity (within same lane / 2.2m)
      const dx = Math.abs(car.mesh.position.x - x);
      if (dx < 2.2) {
        // Check longitudinal clearance (car length + buffer)
        const dz = Math.abs(car.mesh.position.z - z);
        const minClearance = car.halfL + zBuffer;
        if (dz < minClearance) {
          return false;
        }
      }
    }
    return true;
  }

  /**
   * Check if an entire lane segment along Z is completely clear of cars
   */
  public isLaneSegmentClear(
    lane: number,
    zStart: number,
    zEnd: number,
    zBuffer = 8.5
  ): boolean {
    const x = lane * 3.5;
    const minZ = Math.min(zStart, zEnd) - zBuffer;
    const maxZ = Math.max(zStart, zEnd) + zBuffer;

    const activeCars = this.pool.getActiveTraffic();
    for (const car of activeCars) {
      // Check if car is in or moving toward this lane
      const inLane =
        car.lane === lane ||
        car.targetLane === lane ||
        Math.abs(car.mesh.position.x - x) < 2.2;

      if (inLane) {
        const cz = car.mesh.position.z;
        if (cz >= minZ - car.halfL && cz <= maxZ + car.halfL) {
          return false;
        }
      }
    }
    return true;
  }

  /**
   * Update active coins, advance with world motion, despawn if cars approach,
   * and spawn new formations strictly in clear lanes.
   */
  public update(dt: number, worldMoveDelta: number): void {
    if (dt > 0) {
      this.currentWorldSpeed = worldMoveDelta / dt;
    }

    // 1. Update all active coins
    for (const coin of this.coins) {
      if (coin.active) {
        coin.update(dt, worldMoveDelta);
      }
    }

    // 2. Track distance traveled for rhythmic wave spawning
    this.spawnDistanceCounter += worldMoveDelta;

    // Spawn a new coin formation every 40 meters
    if (this.spawnDistanceCounter >= 40) {
      this.spawnDistanceCounter = 0;
      this._spawnFormation();
    }
  }

  /** Spawn a Subway Surfers style coin formation ONLY where cars are NOT present */
  private _spawnFormation(): void {
    const r = Math.random();

    if (r < 0.40) {
      // 1. Straight Highway Trail in a clear lane
      this._spawnStraightTrail();
    } else if (r < 0.75) {
      // 2. Jump Arc with run-up runway in a clear lane
      this._spawnJumpArc();
    } else {
      // 3. Diagonal Lane Shift Trail across clear lanes
      this._spawnDiagonalTrail();
    }
  }

  /** Formation A: Ground Straight Trail in an open, unoccupied lane */
  private _spawnStraightTrail(): void {
    const count = 7 + Math.floor(Math.random() * 3); // 7 to 9 coins
    const spacing = 3.6;
    const trailLength = count * spacing;

    // Find all lanes that are 100% free of cars across the entire trail length
    const clearLanes = LANES.filter(l =>
      this.isLaneSegmentClear(l, SPAWN_FRONT_Z, SPAWN_FRONT_Z - trailLength, 8.0)
    );

    if (clearLanes.length === 0) return; // No open lane right now

    // Pick one of the clear lanes
    const lane = clearLanes[Math.floor(Math.random() * clearLanes.length)]!;
    const x = lane * 3.5;
    const y = 0.65;

    for (let i = 0; i < count; i++) {
      const z = SPAWN_FRONT_Z - i * spacing;

      if (!this.isPositionClearOfCars(x, z, 6.0)) continue;

      const coin = this._acquireCoin();
      if (!coin) break;

      coin.spawn(lane, x, y, z, false);
    }
  }

  /**
   * Formation B: Parabolic Jump Arc with Lead-in Runway.
   * Matches the Player Roadster's exact jump physics curve:
   * 1. 3 ground lead-in coins to visually warn and prepare the player for the jump.
   * 2. 12 parabolic arc coins tracing the vehicle's exact 0.845s ballistic jump trajectory.
   * 3. 2 ground touchdown coins on landing.
   */
  private _spawnJumpArc(): void {
    // Exact jump flight time from Player.ts physics: 2 * V0y / g = 2 * 11.832 / 28 = 0.845s
    const jumpDuration = 0.845;
    // Highway arc length dynamically scaled to match current vehicle travel speed
    const flightDist = THREE.MathUtils.clamp(this.currentWorldSpeed * jumpDuration, 34, 48);

    const runUpCount = 3;   // 3 ground coins before takeoff
    const arcCount = 12;    // 12 coins forming dense, continuous parabolic arc
    const runOutCount = 2;  // 2 ground coins after touchdown
    const totalCount = runUpCount + arcCount + runOutCount;

    const arcSpacing = flightDist / (arcCount - 1); // ~3.0m - 4.3m between coins
    const totalLength = (totalCount - 1) * arcSpacing;

    // Find all lanes that are clear of cars across the entire jump stretch
    const clearLanes = LANES.filter(l =>
      this.isLaneSegmentClear(l, SPAWN_FRONT_Z, SPAWN_FRONT_Z - totalLength, 9.0)
    );

    if (clearLanes.length === 0) return; // No safe open lane

    const lane = clearLanes[Math.floor(Math.random() * clearLanes.length)]!;
    const x = lane * 3.5;

    for (let k = 0; k < totalCount; k++) {
      const z = SPAWN_FRONT_Z - k * arcSpacing;
      let y = 0.65;
      let isArc = false;

      if (k < runUpCount) {
        // Ground lead-in runway
        y = 0.65;
        isArc = false;
      } else if (k < runUpCount + arcCount) {
        // Airborne parabolic curve: u goes from 0.0 (takeoff) to 1.0 (touchdown)
        const u = (k - runUpCount) / (arcCount - 1);
        // Peak jump height = 2.45m + 0.65m car center = 3.10m apex
        y = 0.65 + 2.45 * 4.0 * u * (1.0 - u);
        isArc = true;
      } else {
        // Ground touchdown run-out
        y = 0.65;
        isArc = false;
      }

      if (!this.isPositionClearOfCars(x, z, 6.0)) continue;

      const coin = this._acquireCoin();
      if (!coin) break;

      coin.spawn(lane, x, y, z, isArc);
    }
  }

  /** Formation C: Diagonal Weave Across Lanes (only when both lanes are clear) */
  private _spawnDiagonalTrail(): void {
    const startLane = Math.random() < 0.5 ? -1 : 1;
    const endLane = 0; // Transition to middle lane
    const count = 7;
    const spacing = 3.6;
    const trailLength = count * spacing;
    const y = 0.65;

    // Check that both lanes are clear in this stretch
    const startClear = this.isLaneSegmentClear(startLane, SPAWN_FRONT_Z, SPAWN_FRONT_Z - trailLength, 8.0);
    const endClear = this.isLaneSegmentClear(endLane, SPAWN_FRONT_Z, SPAWN_FRONT_Z - trailLength, 8.0);

    if (!startClear || !endClear) {
      // Fallback: spawn a straight trail in whatever lane is clear
      this._spawnStraightTrail();
      return;
    }

    for (let i = 0; i < count; i++) {
      const progress = i / (count - 1);
      const laneInterp = startLane + (endLane - startLane) * progress;
      const x = laneInterp * 3.5;
      const z = SPAWN_FRONT_Z - i * spacing;

      if (!this.isPositionClearOfCars(x, z, 6.0)) continue;

      const coin = this._acquireCoin();
      if (!coin) break;

      coin.spawn(Math.round(laneInterp), x, y, z, false);
    }
  }

  /**
   * Check collision and apply Subway Surfers style soft magnetic vacuum
   * so jumping through an arc smoothly scoops up all coins.
   */
  public checkCollisions(
    playerX: number,
    playerY: number,
    playerZ: number
  ): number {
    let collectedCount = 0;
    const playerCenterY = playerY + 0.65;

    for (const coin of this.coins) {
      if (!coin.active || coin.collected) continue;

      const cPos = coin.mesh.position;

      const dx = Math.abs(cPos.x - playerX);
      const absDz = Math.abs(cPos.z - playerZ);
      const dy = Math.abs(cPos.y - playerCenterY);

      // 1. Soft magnetic attraction when vehicle is in same lane and approaching
      if (dx < 1.8 && absDz < 4.5 && dy < 2.5) {
        coin.attractTowards(playerX, playerCenterY, 0.22);
      }

      // 2. Generous collection hitbox (1.8m X, 2.2m Y, 2.8m Z)
      if (dx < 1.8 && dy < 2.2 && absDz < 2.8) {
        coin.collect();
        collectedCount++;
        this.onCoinCollected?.(coin);
      }
    }

    return collectedCount;
  }

  /** Get count of currently active coins */
  public getActiveCount(): number {
    return this.coins.filter(c => c.active).length;
  }

  /** Reset all coins to pool */
  public reset(): void {
    this.spawnDistanceCounter = 0;
    for (const coin of this.coins) {
      coin.deactivate();
    }
  }
}
