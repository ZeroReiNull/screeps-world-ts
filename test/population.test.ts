import { describe, it, expect, vi } from 'vitest';
import { fixture, source, structure, spawner, creep, pos } from './mock';
import { inspectRoom } from '../src/core/room';
import { planPopulation } from '../src/core/population';
import { spawn } from '../src/core/spawn';
import { bodyCost } from '../src/core/body';
describe('population and spawning', () => {
  it.each([1, 2, 3, 4, 5, 6, 7, 8])('has valid requests at RCL %i', (level) => {
    const capacities = [0, 300, 550, 800, 1300, 1800, 2300, 5600, 12900];
    const f = fixture(level, capacities[level]);
    spawner(f);
    source(f);
    const plan = planPopulation(inspectRoom(f.room));
    expect(plan.targets.worker).toBeGreaterThan(0);
    for (const req of plan.requests)
      expect(bodyCost(req.body)).toBeLessThanOrEqual(f.room.energyAvailable);
  });
  it('recovers immediately with 200 energy instead of waiting for 12900', () => {
    const f = fixture(8, 12900);
    const s = spawner(f);
    source(f);
    f.room.energyAvailable = 200;
    spawn.runRoom(inspectRoom(f.room));
    expect(s.spawnCreep).toHaveBeenCalledWith(
      [WORK, CARRY, MOVE],
      expect.any(String),
      expect.objectContaining({
        memory: expect.objectContaining({ role: 'worker', home: f.room.name }),
      }),
    );
  });
  it('waits safely below minimum recovery energy', () => {
    const f = fixture();
    const s = spawner(f);
    f.room.energyAvailable = 100;
    spawn.runRoom(inspectRoom(f.room));
    expect(s.spawnCreep).not.toHaveBeenCalled();
  });
  it('requires containers at each source, rather than any container anywhere', () => {
    const f = fixture(3, 800);
    spawner(f);
    source(f);
    structure(f, STRUCTURE_CONTAINER, 40, 39);
    expect(planPopulation(inspectRoom(f.room)).targets.miner).toBe(0);
  });
  it('uses two partial miners at RCL2 to provide enough WORK', () => {
    const f = fixture(2, 550);
    spawner(f);
    source(f);
    structure(f, STRUCTURE_CONTAINER, 11, 10);
    expect(planPopulation(inspectRoom(f.room)).targets.miner).toBe(2);
  });
  it('adds mining WORK when small old miners survive a capacity upgrade', () => {
    const f = fixture(3, 800);
    spawner(f);
    const src = source(f);
    structure(f, STRUCTURE_CONTAINER, 11, 10);
    const old = creep(f, 'miner', [WORK, CARRY, MOVE]);
    old.memory.sourceId = src.id;
    const miners = planPopulation(inspectRoom(f.room)).requests.filter((r) => r.role === 'miner');
    expect(miners).toHaveLength(1);
    expect(miners[0].body.filter((p) => p === WORK)).toHaveLength(4);
  });
  it('counts actual CARRY on old haulers when calculating transport coverage', () => {
    const f = fixture(8, 12900);
    spawner(f);
    source(f, 3, 3);
    structure(f, STRUCTURE_CONTAINER, 4, 3);
    creep(f, 'hauler', [CARRY, MOVE]);
    expect(planPopulation(inspectRoom(f.room)).requests.some((r) => r.role === 'hauler')).toBe(
      true,
    );
  });
  it('sizes urgent defenders with current energy rather than waiting for full RCL8 capacity', () => {
    const f = fixture(8, 12900);
    spawner(f);
    creep(f);
    f.room.energyAvailable = 400;
    const enemy = creep(f, 'defender', [ATTACK, MOVE]);
    delete Game.creeps[enemy.name];
    f.hostiles.push(enemy);
    const request = planPopulation(inspectRoom(f.room)).requests.find(
      (r) => r.role === 'defender',
    )!;
    expect(bodyCost(request.body)).toBe(400);
  });
  it('binds miner spawn requests to separate sources', () => {
    const f = fixture(3, 800);
    spawner(f);
    creep(f);
    const a = source(f),
      b = source(f, 15, 15);
    structure(f, STRUCTURE_CONTAINER, 11, 10);
    structure(f, STRUCTURE_CONTAINER, 16, 15);
    expect(
      planPopulation(inspectRoom(f.room))
        .requests.filter((r) => r.role === 'miner')
        .map((r) => r.sourceId),
    ).toEqual([a.id, b.id]);
  });
  it('increases hauling with source distance', () => {
    const near = fixture(3, 800);
    spawner(near);
    source(near, 23, 23);
    structure(near, STRUCTURE_CONTAINER, 24, 23);
    const short = planPopulation(inspectRoom(near.room)).targets.hauler;
    const far = fixture(3, 800, 'W2N2');
    spawner(far, 'Spawn2');
    source(far, 3, 3);
    structure(far, STRUCTURE_CONTAINER, 4, 3);
    expect(planPopulation(inspectRoom(far.room)).targets.hauler).toBeGreaterThan(short);
  });
  it('replaces near-death miners and includes spawning miners', () => {
    const f = fixture(3, 800);
    spawner(f);
    const src = source(f);
    structure(f, STRUCTURE_CONTAINER, 11, 10);
    const m = creep(f, 'miner', [WORK, WORK, WORK, WORK, WORK, CARRY, MOVE], { ticksToLive: 10 });
    m.memory.sourceId = src.id;
    expect(
      planPopulation(inspectRoom(f.room)).requests.filter((r) => r.role === 'miner'),
    ).toHaveLength(1);
    m.spawning = true;
    expect(
      planPopulation(inspectRoom(f.room)).requests.filter((r) => r.role === 'miner'),
    ).toHaveLength(0);
  });
  it('does not mix populations between rooms', () => {
    const a = fixture(3, 800);
    spawner(a);
    const src = source(a);
    structure(a, STRUCTURE_CONTAINER, 11, 10);
    const b = fixture(3, 800, 'W2N2');
    const foreign = creep(b, 'miner');
    foreign.memory.sourceId = src.id;
    expect(planPopulation(inspectRoom(a.room)).requests.some((r) => r.sourceId === src.id)).toBe(
      true,
    );
  });
  it('spawns guards for armed threats but not scouts', () => {
    const f = fixture(3, 800);
    spawner(f);
    creep(f);
    const invader = creep(f, 'defender', [MOVE]);
    delete Game.creeps[invader.name];
    f.hostiles.push(invader);
    expect(planPopulation(inspectRoom(f.room)).targets.defender).toBe(0);
    vi.mocked(invader.getActiveBodyparts).mockImplementation((part) => (part === ATTACK ? 4 : 0));
    expect(planPopulation(inspectRoom(f.room)).targets.defender).toBeGreaterThan(0);
  });
  it('reserves shared room energy across multiple spawns with unique names', () => {
    const f = fixture(7, 5600);
    const a = spawner(f, 'A'),
      b = spawner(f, 'B');
    f.room.energyAvailable = 600;
    spawn.runRoom(inspectRoom(f.room));
    const calls = [...vi.mocked(a.spawnCreep).mock.calls, ...vi.mocked(b.spawnCreep).mock.calls];
    expect(calls.reduce((sum, c) => sum + bodyCost(c[0]), 0)).toBeLessThanOrEqual(600);
    expect(new Set(calls.map((c) => c[1])).size).toBe(calls.length);
  });
  it('does not advance the spawn queue on a failed spawn', () => {
    const f = fixture(7, 5600);
    const a = spawner(f, 'A'),
      b = spawner(f, 'B');
    f.room.energyAvailable = 300;
    vi.mocked(a.spawnCreep).mockReturnValue(ERR_BUSY);
    spawn.runRoom(inspectRoom(f.room));
    expect(b.spawnCreep).toHaveBeenCalled();
    expect(vi.mocked(b.spawnCreep).mock.calls[0][2]?.memory?.role).toBe('worker');
  });
  it('recovers when every remaining miner has lost its WORK parts', () => {
    const f = fixture(8, 12900);
    spawner(f);
    const src = source(f);
    structure(f, STRUCTURE_CONTAINER, 11, 10);
    const m = creep(f, 'miner', [CARRY, MOVE]);
    m.memory.sourceId = src.id;
    creep(f, 'hauler', [CARRY, MOVE]);
    f.room.energyAvailable = 200;
    expect(planPopulation(inspectRoom(f.room)).requests[0].role).toBe('worker');
  });
  it('pre-spawns a replacement hauler without forcing an emergency worker', () => {
    const f = fixture(8, 12900);
    spawner(f);
    const src = source(f);
    structure(f, STRUCTURE_CONTAINER, 11, 10);
    const m = creep(f, 'miner');
    m.memory.sourceId = src.id;
    creep(f, 'hauler', [CARRY, MOVE], { ticksToLive: 1 });
    expect(planPopulation(inspectRoom(f.room)).requests[0].role).toBe('hauler');
  });
});

describe('guard reserves', () => {
  it('keeps a low-priority guard after an attack and expires the reserve', () => {
    const f = fixture(3, 800);
    spawner(f);
    structure(f, STRUCTURE_TOWER, 24, 25, 1000);
    f.room.memory.lastThreat = Game.time;
    let plan = planPopulation(inspectRoom(f.room));
    expect(plan.targets.defender).toBe(1);
    expect(plan.requests.find((r) => r.role === 'defender')?.priority).toBe(6);
    Game.time += 1500;
    expect(planPopulation(inspectRoom(f.room)).targets.defender).toBe(0);
  });
  it('does not maintain a standby guard at RCL2 or during safe mode', () => {
    const f = fixture(2, 550);
    spawner(f);
    f.room.memory.lastThreat = Game.time;
    expect(planPopulation(inspectRoom(f.room)).targets.defender).toBe(0);
    f.room.controller!.safeMode = 100;
    const enemy = creep(f, 'defender', [ATTACK, MOVE]);
    delete Game.creeps[enemy.name];
    f.hostiles.push(enemy);
    expect(planPopulation(inspectRoom(f.room)).targets.defender).toBe(0);
  });
});

describe('mining and controller hauling budgets', () => {
  it('allocates only five WORK across new RCL2 miners', () => {
    const f = fixture(2, 550);
    spawner(f);
    source(f);
    structure(f, STRUCTURE_CONTAINER, 11, 10);
    const miners = planPopulation(inspectRoom(f.room)).requests.filter((r) => r.role === 'miner');
    expect(miners.map((r) => r.body.filter((p) => p === WORK).length)).toEqual([4, 1]);
  });
  it('adds transport capacity for distant controller supply', () => {
    const f = fixture(2, 550);
    spawner(f, 'Spawn1', 5, 5);
    source(f, 3, 3);
    structure(f, STRUCTURE_CONTAINER, 4, 3);
    const baseline = planPopulation(inspectRoom(f.room)).targets.hauler;
    f.room.controller!.pos = pos(48, 48);
    structure(f, STRUCTURE_CONTAINER, 47, 48);
    expect(planPopulation(inspectRoom(f.room)).targets.hauler).toBeGreaterThan(baseline);
  });
});
