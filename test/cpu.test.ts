import { describe, expect, it, vi } from 'vitest';
import { fixture, spawner, structure, creep, source } from './mock';
import { finishCpu, optionalCpu, optionalTask } from '../src/core/cpu';
import { inspectRoom } from '../src/core/room';
import { loop } from '../src/main';
function cpu() {
  Game.cpu.limit = 20; Game.cpu.tickLimit = 500; Game.cpu.getUsed = vi.fn(() => 5);
}
function stable() {
  cpu(); const f = fixture(4,1300); spawner(f); creep(f);
  structure(f,STRUCTURE_STORAGE,26,25,30000,1000000);
  structure(f,STRUCTURE_TOWER,24,25,1000); return f;
}
function samples(f: ReturnType<typeof fixture>, n=200) {
  for(let i=0;i<n;i++) { finishCpu([inspectRoom(f.room)],true); Game.time++; }
}
describe('CPU and pixel policy', () => {
  it('does not generate pixels by default even with full bucket', () => {
    const f=stable(); samples(f); expect(Game.cpu.generatePixel).not.toHaveBeenCalled();
  });
  it('requires explicit opt-in and 200 consecutive low-CPU samples', () => {
    const f=stable(); Memory.cpuPolicy={generatePixel:true}; samples(f,199);
    expect(Game.cpu.generatePixel).not.toHaveBeenCalled(); samples(f,1);
    expect(Game.cpu.generatePixel).toHaveBeenCalledOnce();
    expect(Memory.cpuStats?.recovering).toBe(true);
  });
  it('refuses pixels after a recent threat', () => {
    const f=stable(); Memory.cpuPolicy={generatePixel:true};
    f.room.memory.lastThreat=Game.time; samples(f);
    expect(Game.cpu.generatePixel).not.toHaveBeenCalled();
  });
  it('resets CPU headroom history after a spike or an incomplete tick', () => {
    const f=stable(); Memory.cpuPolicy={generatePixel:true}; samples(f,199);
    vi.mocked(Game.cpu.getUsed).mockReturnValue(19); samples(f,1);
    expect(Memory.cpuStats?.safeTicks).toBe(0);
    vi.mocked(Game.cpu.getUsed).mockReturnValue(5); samples(f,199);
    finishCpu([inspectRoom(f.room)],false);
    expect(Memory.cpuStats?.safeTicks).toBe(0);
    expect(Game.cpu.generatePixel).not.toHaveBeenCalled();
  });
  it('preserves bucket recovery until 3000 and skips costly optional work', () => {
    cpu(); Game.cpu.bucket=500; expect(optionalCpu()).toBe(false);
    finishCpu([],true); Game.cpu.bucket=2000; expect(optionalCpu()).toBe(false);
    Game.cpu.bucket=3000; expect(optionalCpu()).toBe(true);
    vi.mocked(Game.cpu.getUsed).mockReturnValue(15); expect(optionalCpu()).toBe(false);
  });
  it('still spawns and runs economic creeps with low bucket', () => {
    cpu(); Game.cpu.bucket=100; const f=fixture(2); const s=spawner(f); source(f); const c=creep(f);
    loop(); expect(s.spawnCreep).toHaveBeenCalled(); expect(c.harvest).toHaveBeenCalled();
    expect(f.room.createConstructionSite).not.toHaveBeenCalled();
  });
  it('does not generate without CPU measurement support', () => {
    const f=stable(); Memory.cpuPolicy={generatePixel:true};
    delete (Game.cpu as Partial<CPU>).getUsed;
    samples(f); expect(Game.cpu.generatePixel).not.toHaveBeenCalled();
  });
});

describe('record-based pixel scheduling', () => {
  it('allows stable RCL2 without storage or towers', () => {
    cpu(); const f=fixture(2,550);spawner(f);creep(f);source(f);
    structure(f,STRUCTURE_CONTAINER,11,10,1500,2000);
    Memory.cpuPolicy={generatePixel:true};samples(f);
    expect(Game.cpu.generatePixel).toHaveBeenCalledOnce();
  });
  it('records peak and over-limit ticks and waits until a spike ages out', () => {
    const f=stable();Memory.cpuPolicy={generatePixel:true};
    vi.mocked(Game.cpu.getUsed).mockReturnValue(25);samples(f,1);
    expect(Memory.cpuStats?.overLimitTicks).toBe(1);
    vi.mocked(Game.cpu.getUsed).mockReturnValue(8);samples(f,199);
    expect(Memory.cpuStats?.peak).toBe(25);
    expect(Memory.cpuStats?.pixelReason).toBe('cpu-headroom');
    expect(Game.cpu.generatePixel).not.toHaveBeenCalled();
    samples(f,1);expect(Game.cpu.generatePixel).toHaveBeenCalledOnce();
    expect(Memory.cpuStats?.peakEver).toBe(25);
  });
  it('pauses optional tasks for 25 ticks after pixel even if bucket recovers early', () => {
    const f=stable();Memory.cpuPolicy={generatePixel:true};samples(f);
    expect(optionalCpu()).toBe(false);Game.time+=25;
    expect(optionalCpu()).toBe(true);
  });
  it('discards history after a missed tick or CPU limit change', () => {
    const f=stable();samples(f,199);Game.time+=2;samples(f,1);
    expect(Memory.cpuStats?.samples).toBe(1);
    Game.cpu.limit=10;samples(f,1);expect(Memory.cpuStats?.samples).toBe(1);
  });
  it('requires continuous economic stability and does not clear bucket on generation failure', () => {
    const f=stable();Memory.cpuPolicy={generatePixel:true};samples(f,199);
    f.room.energyAvailable=0;samples(f,1);expect(Memory.cpuStats?.stableTicks).toBe(0);
    f.room.energyAvailable=1300;
    vi.mocked(Game.cpu.generatePixel).mockReturnValue(ERR_NOT_ENOUGH_RESOURCES);
    samples(f);expect(Memory.cpuStats?.pixelReason).toBe('generation-failed');
    expect(Memory.cpuStats?.lastPixel).toBeUndefined();expect(Memory.cpuStats?.recovering).toBe(false);
  });
  it('accounts for estimated task cost and reserve before optional work', () => {
    cpu();vi.mocked(Game.cpu.getUsed).mockReturnValue(8);
    expect(optionalCpu(6)).toBe(true);expect(optionalCpu(8)).toBe(false);
  });
});


it('uses measured optional task cost to avoid overcommitting the next tick', () => {
  cpu();
  vi.mocked(Game.cpu.getUsed).mockReturnValueOnce(5).mockReturnValueOnce(5).mockReturnValueOnce(11);
  const task=vi.fn();optionalTask('planner:test',task);
  expect(task).toHaveBeenCalledOnce();expect(Memory.cpuTaskCosts?.['planner:test']).toBe(6);
  vi.mocked(Game.cpu.getUsed).mockReturnValue(10);
  optionalTask('planner:test',task);expect(task).toHaveBeenCalledOnce();
});
