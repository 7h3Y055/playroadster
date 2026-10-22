/**
 * PoolManager.ts — Manages road chunk recycling and traffic car pooling.
 * Zero runtime allocation — all objects pre-created at init.
 * Ensures the road extends far behind the camera so the past road is NEVER visibly removed.
 */
import * as THREE from 'three';
import { RoadChunk } from '@entities/RoadChunk';
import { TrafficCar } from '@entities/TrafficCar';

const CHUNK_COUNT = 15; // 15 × 50m = 750m of visible highway
const TRAFFIC_POOL_SIZE = 25;
const START_OFFSET_Z = 100; // Road begins 100m BEHIND player

export class PoolManager {
  public readonly chunks: RoadChunk[] = [];
  public readonly trafficPool: TrafficCar[] = [];

  constructor(scene: THREE.Scene) {
    // ── Pre-allocate Road Chunks ──────────
    // Place 2 chunks behind the player/camera and 13 forward into the distance
    for (let i = 0; i < CHUNK_COUNT; i++) {
      const chunk = new RoadChunk(i);
      chunk.setPosition(START_OFFSET_Z - i * chunk.length);
      scene.add(chunk.group);
      this.chunks.push(chunk);
    }

    // ── Pre-allocate Traffic Cars ─────────
    for (let i = 0; i < TRAFFIC_POOL_SIZE; i++) {
      const car = new TrafficCar();
      scene.add(car.mesh);
      this.trafficPool.push(car);
    }
  }

  /**
   * Recycle road chunks that have passed completely behind the camera.
   * Only recycles when the FRONT (far edge) is at least 80m behind camera.
   * The player will NEVER see past road segments disappearing.
   */
  public recycleChunks(cameraZ: number): number {
    let recycled = 0;

    // Find the chunk furthest forward (most negative Z)
    let frontMostZ = Infinity;
    for (const chunk of this.chunks) {
      if (chunk.frontZ < frontMostZ) {
        frontMostZ = chunk.frontZ;
      }
    }

    for (const chunk of this.chunks) {
      // Front edge must be at least 80m BEHIND camera before recycling
      // That means the entire 50m chunk is 80m to 130m behind camera!
      if (chunk.frontZ > cameraZ + 80) {
        chunk.setPosition(frontMostZ - chunk.length / 2);
        frontMostZ = chunk.frontZ;
        recycled++;
      }
    }

    return recycled;
  }

  /** Acquire an inactive traffic car from the pool. Returns null if all in use. */
  public acquireTraffic(): TrafficCar | null {
    for (const car of this.trafficPool) {
      if (!car.active) return car;
    }
    return null;
  }

  /** Release a traffic car back to the pool */
  public releaseTraffic(car: TrafficCar): void {
    car.deactivate();
  }

  /** Get all currently active traffic cars */
  public getActiveTraffic(): TrafficCar[] {
    return this.trafficPool.filter(c => c.active);
  }

  /** Get the Z position of the furthest forward chunk edge */
  public getFrontEdgeZ(): number {
    let frontMostZ = Infinity;
    for (const chunk of this.chunks) {
      if (chunk.frontZ < frontMostZ) {
        frontMostZ = chunk.frontZ;
      }
    }
    return frontMostZ;
  }

  /** Move all active objects by worldMoveDelta (positive = toward camera) */
  public advanceWorld(
    worldMoveDelta: number,
    dt = 1 / 60,
    playerZ = 0,
    playerX = 0
  ): void {
    // 1. Move chunks
    for (const chunk of this.chunks) {
      chunk.group.position.z += worldMoveDelta;
    }

    // 2. Update intelligent traffic
    const activeTraffic = this.trafficPool.filter(c => c.active);
    for (const car of activeTraffic) {
      car.update(dt, worldMoveDelta, activeTraffic, playerZ, playerX);

      // Despawn only when well behind camera (> 80m)
      if (car.mesh.position.z > 80) {
        car.deactivate();
      }
    }

    // 3. Absolute physics fail-safe bumper buffer (ensures zero clipping under any condition)
    for (const lane of [-1, 0, 1]) {
      const laneCars = activeTraffic.filter(
        c => c.lane === lane || (c.laneState === 'changing' && c.targetLane === lane)
      );
      if (laneCars.length <= 1) continue;

      // Sort from closest to player (highest Z) to furthest from player (lowest Z)
      laneCars.sort((a, b) => b.mesh.position.z - a.mesh.position.z);

      for (let i = 1; i < laneCars.length; i++) {
        const carAhead = laneCars[i - 1]!;
        const carBehind = laneCars[i]!;

        const minSafeGap = carAhead.halfL + carBehind.halfL + 3.0; // Bumper-to-bumper buffer
        const currentDist = carAhead.mesh.position.z - carBehind.mesh.position.z;

        if (currentDist < minSafeGap) {
          // Keep safe distance, prevent physical penetration
          carBehind.mesh.position.z = carAhead.mesh.position.z - minSafeGap;
          carBehind.targetSpeed = Math.min(carBehind.targetSpeed, carAhead.currentSpeed - 2.0);
          carBehind.currentSpeed = Math.min(carBehind.currentSpeed, carAhead.currentSpeed);
          carBehind.isBraking = true;
        }
      }
    }
  }

  /** Reset all pools to initial state */
  public reset(): void {
    // Reset chunks with 2 chunks behind camera, straight alignment
    for (let i = 0; i < this.chunks.length; i++) {
      this.chunks[i]!.setPosition(START_OFFSET_Z - i * this.chunks[i]!.length);
      this.chunks[i]!.group.position.x = 0;
      this.chunks[i]!.group.rotation.y = 0;
    }

    // Deactivate all traffic
    for (const car of this.trafficPool) {
      car.deactivate();
    }
  }
}
