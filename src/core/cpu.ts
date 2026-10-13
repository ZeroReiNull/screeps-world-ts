import { CONFIG } from '../config';
import type { RoomState } from './room';

export function cpuUsed(): number {
  return typeof Game.cpu.getUsed === 'function' ? Game.cpu.getUsed() : 0;
}

export function recoveringCpu(): boolean {
  return Game.cpu.bucket <= 1000 || (!!Memory.cpuStats?.recovering && Game.cpu.bucket < 3000);
}

/** Optional work is postponed, never core defense, spawning, or economic actions. */
export function optionalCpu(): boolean {
  const limit = Math.min(Game.cpu.limit || 20, Game.cpu.tickLimit || 20);
  return !recoveringCpu() && cpuUsed() < limit * 0.6;
}

export function finishCpu(states: RoomState[], completed: boolean): void {
  const used = cpuUsed();
  const previous = Memory.cpuStats;
  const continuous = previous?.tick === Game.time - 1;
  const safe =
    completed &&
    typeof Game.cpu.getUsed === 'function' &&
    Game.cpu.limit > 0 &&
    used < Game.cpu.limit * 0.6;
  const safeTicks = safe ? (continuous ? previous.safeTicks : 0) + 1 : 0;
  const average = continuous ? previous.average * 0.95 + used * 0.05 : used;
  const recovering = recoveringCpu();
  Memory.cpuStats = {
    tick: Game.time,
    used,
    average,
    bucket: Game.cpu.bucket,
    recovering,
    safeTicks,
    lastPixel: previous?.lastPixel,
  };
  const enabled = Memory.cpuPolicy?.generatePixel ?? CONFIG.generatePixel;
  if (
    !enabled ||
    recovering ||
    Game.cpu.bucket < 10000 ||
    safeTicks < 100 ||
    typeof Game.cpu.generatePixel !== 'function' ||
    !states.length
  )
    return;
  // A pixel consumes the entire bucket. Only opt in with CPU headroom and established rooms.
  const ready = states.every(
    (state) =>
      state.room.controller!.level >= 4 &&
      !state.hostiles.length &&
      !state.room.controller!.safeMode &&
      (state.room.memory.lastThreat === undefined ||
        Game.time - state.room.memory.lastThreat >= 2000) &&
      state.spawns.length > 0 &&
      state.room.energyAvailable >= state.room.energyCapacityAvailable * 0.8 &&
      !!state.room.storage &&
      state.room.storage.store[RESOURCE_ENERGY] >= 20000 &&
      state.towers.some((t) => t.store[RESOURCE_ENERGY] >= 700) &&
      state.creeps.some(
        (c) =>
          !c.spawning &&
          (c.memory.role === 'worker' || c.memory.role === 'miner') &&
          c.getActiveBodyparts(WORK) > 0,
      ) &&
      (state.room.controller?.ticksToDowngrade ?? 0) > 5000,
  );
  if (!ready) return;
  const result = Game.cpu.generatePixel();
  Memory.cpuStats.pixelResult = result;
  if (result === OK) {
    Memory.cpuStats.lastPixel = Game.time;
    Memory.cpuStats.safeTicks = 0;
    Memory.cpuStats.recovering = true;
  }
}
