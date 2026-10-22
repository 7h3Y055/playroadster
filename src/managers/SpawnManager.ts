/**
 * SpawnManager.ts — Intelligent traffic formation generator and difficulty progression.
 * Spawns organic highway scenarios: solo cruisers, overtaking tandems, slalom waves,
 * gates, and impatient swerving taxis. Guarantees fair, solvable arcade gameplay.
 */
import { TrafficCar } from '@entities/TrafficCar';
import { PoolManager } from '@managers/PoolManager';
import type { Updatable } from '@core/GameLoop';

interface DifficultyBracket {
  maxDist: number;
  spawnInterval: number; // Seconds between wave spawns
  allowGates: boolean;
  allowSlalom: boolean;
}

const DIFFICULTY_CURVE: DifficultyBracket[] = [
  { maxDist: 250,      spawnInterval: 2.2, allowGates: false, allowSlalom: false },
  { maxDist: 600,      spawnInterval: 1.8, allowGates: true,  allowSlalom: false },
  { maxDist: 1200,     spawnInterval: 1.4, allowGates: true,  allowSlalom: true  },
  { maxDist: 2500,     spawnInterval: 1.1, allowGates: true,  allowSlalom: true  },
  { maxDist: Infinity, spawnInterval: 0.85, allowGates: true, allowSlalom: true },
];

const BASE_SPAWN_Z = -155; // Far forward along highway
const LANES = [-1, 0, 1];

export class SpawnManager implements Updatable {
  private spawnTimer = 0;
  private distance = 0;

  private readonly pool: PoolManager;

  constructor(pool: PoolManager) {
    this.pool = pool;
  }

  public setDistance(dist: number): void {
    this.distance = dist;
  }

  public update(dt: number): void {
    const bracket = this._getCurrentBracket();
    this.spawnTimer += dt;

    if (this.spawnTimer >= bracket.spawnInterval) {
      this.spawnTimer -= bracket.spawnInterval;
      this._spawnNextScenario(bracket);
    }
  }

  private _getCurrentBracket(): DifficultyBracket {
    for (const b of DIFFICULTY_CURVE) {
      if (this.distance < b.maxDist) return b;
    }
    return DIFFICULTY_CURVE[DIFFICULTY_CURVE.length - 1]!;
  }

  /** Select and execute a rhythmic traffic scenario */
  private _spawnNextScenario(bracket: DifficultyBracket): void {
    const r = Math.random();

    if (bracket.allowSlalom && r < 0.28) {
      this._spawnSlalomFormation();
    } else if (bracket.allowGates && r < 0.55) {
      this._spawnGateFormation();
    } else if (r < 0.78) {
      this._spawnOvertakeTandem();
    } else {
      this._spawnSoloCruiser();
    }
  }

  /** Scenario 1: Solo vehicle (cruiser, speeder, or swerving taxi) */
  private _spawnSoloCruiser(): void {
    const lane = LANES[Math.floor(Math.random() * LANES.length)]!;
    if (!this._isLaneClear(lane, BASE_SPAWN_Z, 30)) return;

    const car = this.pool.acquireTraffic();
    if (!car) return;

    const type = TrafficCar.randomType();
    car.configure(type, lane, BASE_SPAWN_Z);
  }

  /** Scenario 2: Overtake Tandem — Slower vehicle being overtaken by a faster vehicle */
  private _spawnOvertakeTandem(): void {
    // Pick two adjacent lanes (e.g. 0 & -1, or 0 & 1)
    const baseLane = Math.random() < 0.5 ? 0 : (Math.random() < 0.5 ? -1 : 1);
    const otherLane = baseLane === 0 ? (Math.random() < 0.5 ? -1 : 1) : 0;

    const slowZ = BASE_SPAWN_Z;
    const fastZ = BASE_SPAWN_Z + 16; // 16m behind, closing the gap!

    if (!this._isLaneClear(baseLane, slowZ, 26) || !this._isLaneClear(otherLane, fastZ, 26)) {
      this._spawnSoloCruiser();
      return;
    }

    const leadCar = this.pool.acquireTraffic();
    if (leadCar) {
      const slowType = Math.random() < 0.6 ? 'delivery' : (Math.random() < 0.5 ? 'van' : 'sedan');
      leadCar.configure(slowType, baseLane, slowZ, 'cautious', -3.0);
    }

    const passCar = this.pool.acquireTraffic();
    if (passCar) {
      const fastType = Math.random() < 0.5 ? 'sedan-sports' : 'taxi';
      passCar.configure(fastType, otherLane, fastZ, 'speeder', 4.0);
    }
  }

  /** Scenario 3: Slalom Formation — 3 cars staggered along Z across lanes */
  private _spawnSlalomFormation(): void {
    const laneOrder = Math.random() < 0.5 ? [-1, 0, 1] : [1, 0, -1];
    const zOffsets = [0, 24, 48]; // Staggered by 24m, giving ample reaction time to weave!

    for (let i = 0; i < 3; i++) {
      const lane = laneOrder[i]!;
      const z = BASE_SPAWN_Z + zOffsets[i]!;

      if (!this._isLaneClear(lane, z, 22)) continue;

      const car = this.pool.acquireTraffic();
      if (!car) break;

      const type = TrafficCar.randomType();
      car.configure(type, lane, z, 'cruiser');
    }
  }

  /** Scenario 4: Gate — Two cars side-by-side leaving one lane guaranteed open */
  private _spawnGateFormation(): void {
    // Pick which lane remains open (guaranteed solvable pathway)
    const openLane = LANES[Math.floor(Math.random() * LANES.length)]!;
    const blockedLanes = LANES.filter(l => l !== openLane);

    for (const lane of blockedLanes) {
      if (!this._isLaneClear(lane, BASE_SPAWN_Z, 28)) continue;

      const car = this.pool.acquireTraffic();
      if (!car) continue;

      const type = TrafficCar.randomType();
      car.configure(type, lane, BASE_SPAWN_Z, 'cruiser');
    }
  }

  /** Check if a lane is free from active vehicles within buffer distance */
  private _isLaneClear(lane: number, z: number, bufferMeters: number): boolean {
    const active = this.pool.getActiveTraffic();
    for (const car of active) {
      if (car.lane === lane || car.targetLane === lane) {
        if (Math.abs(car.mesh.position.z - z) < bufferMeters) {
          return false;
        }
      }
    }
    return true;
  }

  public reset(): void {
    this.spawnTimer = 0;
    this.distance = 0;
  }
}
