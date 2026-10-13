import { CONFIG, settings } from '../config';
import type { RoomState } from './room';

const WINDOW = 200;
const RECOVERY_TICKS = 25;

export function cpuUsed(): number {
  return typeof Game.cpu.getUsed === 'function' ? Game.cpu.getUsed() : 0;
}

export function recoveringCpu(): boolean {
  const lastPixel = Memory.cpuStats?.lastPixel;
  const pixelRecovery = lastPixel !== undefined && Game.time - lastPixel <= RECOVERY_TICKS;
  return pixelRecovery || Game.cpu.bucket <= 1000
    || (!!Memory.cpuStats?.recovering && Game.cpu.bucket < 3000);
}

/** Budget estimates leave at least 25% of base CPU for variation and bookkeeping. */
export function optionalCpu(estimatedCost = 2): boolean {
  const limit = Math.min(Game.cpu.limit || 20, Game.cpu.tickLimit || 20);
  const reserve = Math.max(2, limit * 0.25);
  return !recoveringCpu() && cpuUsed() + estimatedCost <= limit - reserve;
}

/** Retain a decaying high-water estimate for optional task scheduling. */
export function optionalTask(key: string, task: () => void): void {
  const costs = Memory.cpuTaskCosts ??= {};
  if (!optionalCpu(costs[key] ?? 2)) return;
  const start = cpuUsed();
  try { task(); } finally {
    costs[key] = Math.max(0.25, (costs[key] ?? 0) * 0.98, cpuUsed() - start);
  }
}

function economyReady(state: RoomState): boolean {
  const { room, creeps, sources, containers } = state;
  const cfg = settings(room);
  const worker = creeps.some(c => !c.spawning && c.memory.role === 'worker'
    && c.getActiveBodyparts(WORK) > 0 && c.getActiveBodyparts(CARRY) > 0);
  const miningChain = sources.length > 0 && sources.every(source => creeps.some(c =>
    !c.spawning && c.memory.role === 'miner' && c.memory.sourceId === source.id && c.getActiveBodyparts(WORK) > 0))
    && creeps.some(c => !c.spawning && c.memory.role === 'hauler' && c.getActiveBodyparts(CARRY) > 0);
  const buffer = room.storage ? room.storage.store[RESOURCE_ENERGY] >= cfg.storageReserve
    : containers.filter(c => sources.some(s => s.pos.inRangeTo(c, 1)))
      .reduce((n, c) => n + c.store[RESOURCE_ENERGY], 0) >= room.energyCapacityAvailable;
  return !state.hostiles.length && !room.controller?.safeMode
    && (room.memory.lastThreat === undefined || Game.time - room.memory.lastThreat >= 2000)
    && state.spawns.some(s => s.isActive()) && (worker || miningChain) && buffer
    && room.energyAvailable >= room.energyCapacityAvailable * 0.8
    && state.towers.every(t => t.store[RESOURCE_ENERGY] >= 700)
    && !creeps.some(c => c.memory.retreatUntil && c.memory.retreatUntil >= Game.time)
    && (room.controller?.ticksToDowngrade ?? 0) > 5000;
}

export function finishCpu(states: RoomState[], completed: boolean): void {
  const used = cpuUsed();
  const previous = Memory.cpuStats;
  const continuous = previous?.tick === Game.time - 1;
  const measured = typeof Game.cpu.getUsed === 'function' && Number.isFinite(used) && Game.cpu.limit > 0;
  let history = Memory.cpuHistory;
  if (!continuous || !history || history.limit !== Game.cpu.limit || !completed || !measured) {
    history = Memory.cpuHistory = { limit: Game.cpu.limit, samples: [] };
  }
  if (completed && measured) {
    history.samples.push(used);
    if (history.samples.length > WINDOW) history.samples.shift();
  }
  const samples = history.samples;
  const average = samples.length ? samples.reduce((a, b) => a + b, 0) / samples.length : used;
  const peak = samples.length ? Math.max(...samples) : used;
  const overLimitTicks = samples.filter(n => n > Game.cpu.limit).length;
  const safe = completed && measured && used <= Game.cpu.limit * 0.6;
  const safeTicks = safe ? (continuous ? previous.safeTicks : 0) + 1 : 0;
  const ready = states.length > 0 && states.every(economyReady);
  const stableTicks = ready && completed ? (continuous ? previous.stableTicks ?? 0 : 0) + 1 : 0;
  const recovering = recoveringCpu();
  const enabled = Memory.cpuPolicy?.generatePixel ?? CONFIG.generatePixel;
  let reason = !enabled ? 'disabled' : !measured ? 'no-cpu-measurement'
    : !completed ? 'tick-error' : recovering ? 'recovering'
    : !ready || stableTicks < WINDOW ? 'economy-observation'
    : samples.length < WINDOW ? 'cpu-observation'
    : average > Game.cpu.limit * 0.6 || peak > Game.cpu.limit * 0.8 || !safe ? 'cpu-headroom'
    : Game.cpu.bucket < 10000 ? 'bucket-not-full'
    : typeof Game.cpu.generatePixel !== 'function' ? 'unsupported' : 'ready';
  Memory.cpuStats = {
    tick: Game.time, used, average, peak, peakEver: Math.max(previous?.peakEver ?? 0, used),
    overLimitTicks, samples: samples.length, bucket: Game.cpu.bucket, recovering, safeTicks,
    stableTicks, pixelReason: reason, lastPixel: previous?.lastPixel, pixelResult: previous?.pixelResult,
  };
  // Pixel costs the entire bucket; these checks reduce risk but cannot retain a reserve.
  if (reason !== 'ready') return;
  const result = Game.cpu.generatePixel();
  Memory.cpuStats.pixelResult = result;
  if (result === OK) {
    Memory.cpuStats.lastPixel = Game.time;
    Memory.cpuStats.safeTicks = 0;
    Memory.cpuStats.recovering = true;
    Memory.cpuStats.pixelReason = 'generated';
  } else Memory.cpuStats.pixelReason = 'generation-failed';
}
