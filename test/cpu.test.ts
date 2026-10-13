import { describe, expect, it, vi } from 'vitest';
import { fixture, spawner, structure, creep, source } from './mock';
import { finishCpu, optionalCpu } from '../src/core/cpu';
import { inspectRoom } from '../src/core/room';
import { loop } from '../src/main';
function cpu() {
  Game.cpu.limit = 20;
  Game.cpu.tickLimit = 500;
  Game.cpu.getUsed = vi.fn(() => 5);
}
function stable() {
  cpu();
  const f = fixture(4, 1300);
  spawner(f);
  creep(f);
  structure(f, STRUCTURE_STORAGE, 26, 25, 30000, 1000000);
  structure(f, STRUCTURE_TOWER, 24, 25, 1000);
  return f;
}
function samples(f: ReturnType<typeof fixture>, n = 100) {
  for (let i = 0; i < n; i++) {
    finishCpu([inspectRoom(f.room)], true);
    Game.time++;
  }
}
describe('CPU and pixel policy', () => {
  it('does not generate pixels by default even with full bucket', () => {
    const f = stable();
    samples(f);
    expect(Game.cpu.generatePixel).not.toHaveBeenCalled();
  });
  it('requires explicit opt-in and 100 consecutive low-CPU samples', () => {
    const f = stable();
    Memory.cpuPolicy = { generatePixel: true };
    samples(f, 99);
    expect(Game.cpu.generatePixel).not.toHaveBeenCalled();
    samples(f, 1);
    expect(Game.cpu.generatePixel).toHaveBeenCalledOnce();
    expect(Memory.cpuStats?.recovering).toBe(true);
  });
  it('refuses pixels in an early room or after a recent threat', () => {
    const f = stable();
    Memory.cpuPolicy = { generatePixel: true };
    f.room.controller!.level = 2;
    samples(f);
    expect(Game.cpu.generatePixel).not.toHaveBeenCalled();
    f.room.controller!.level = 4;
    f.room.memory.lastThreat = Game.time;
    samples(f);
    expect(Game.cpu.generatePixel).not.toHaveBeenCalled();
  });
  it('resets CPU headroom history after a spike or an incomplete tick', () => {
    const f = stable();
    Memory.cpuPolicy = { generatePixel: true };
    samples(f, 99);
    vi.mocked(Game.cpu.getUsed).mockReturnValue(19);
    samples(f, 1);
    expect(Memory.cpuStats?.safeTicks).toBe(0);
    vi.mocked(Game.cpu.getUsed).mockReturnValue(5);
    samples(f, 99);
    finishCpu([inspectRoom(f.room)], false);
    expect(Memory.cpuStats?.safeTicks).toBe(0);
    expect(Game.cpu.generatePixel).not.toHaveBeenCalled();
  });
  it('preserves bucket recovery until 3000 and skips costly optional work', () => {
    cpu();
    Game.cpu.bucket = 500;
    expect(optionalCpu()).toBe(false);
    finishCpu([], true);
    Game.cpu.bucket = 2000;
    expect(optionalCpu()).toBe(false);
    Game.cpu.bucket = 3000;
    expect(optionalCpu()).toBe(true);
    vi.mocked(Game.cpu.getUsed).mockReturnValue(15);
    expect(optionalCpu()).toBe(false);
  });
  it('still spawns and runs economic creeps with low bucket', () => {
    cpu();
    Game.cpu.bucket = 100;
    const f = fixture(2);
    const s = spawner(f);
    source(f);
    const c = creep(f);
    loop();
    expect(s.spawnCreep).toHaveBeenCalled();
    expect(c.harvest).toHaveBeenCalled();
    expect(f.room.createConstructionSite).not.toHaveBeenCalled();
  });
  it('does not generate without CPU measurement support', () => {
    const f = stable();
    Memory.cpuPolicy = { generatePixel: true };
    delete (Game.cpu as Partial<CPU>).getUsed;
    samples(f);
    expect(Game.cpu.generatePixel).not.toHaveBeenCalled();
  });
});
