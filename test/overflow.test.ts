import { describe, expect, it } from 'vitest';
import { fixture, source, structure, spawner, creep, store } from './mock';
import { inspectRoom } from '../src/core/room';
import { planPopulation } from '../src/core/population';
import { RoleHauler } from '../src/roles/RoleHauler';
function economy() {
  const f = fixture(2, 550);
  spawner(f); source(f, 10, 10); source(f, 15, 15);
  const a = structure<StructureContainer>(f, STRUCTURE_CONTAINER, 11, 10, 1600, 2000);
  const b = structure<StructureContainer>(f, STRUCTURE_CONTAINER, 16, 15, 1600, 2000);
  return { f, a, b };
}
function activate(f: ReturnType<typeof fixture>) {
  planPopulation(inspectRoom(f.room)); Game.time += 100;
  return planPopulation(inspectRoom(f.room));
}
describe('early-room energy overflow', () => {
  it('waits for sustained surplus and preserves spawn priorities', () => {
    const { f } = economy();
    expect(planPopulation(inspectRoom(f.room)).targets.upgrader).toBe(1);
    Game.time += 99;
    expect(planPopulation(inspectRoom(f.room)).targets.upgrader).toBe(1);
    Game.time++;
    const plan = planPopulation(inspectRoom(f.room));
    expect(plan.targets.upgrader).toBe(5);
    expect(plan.requests.filter(r => r.role === 'upgrader').every(r => r.priority > 3)).toBe(true);
  });
  it('survives a brief refill but exits when reserves run low', () => {
    const { f, a, b } = economy(); activate(f);
    f.room.energyAvailable = 100;
    a.store.energy = b.store.energy = 600;
    expect(planPopulation(inspectRoom(f.room)).targets.upgrader).toBe(5);
    a.store.energy = b.store.energy = 300;
    expect(planPopulation(inspectRoom(f.room)).targets.upgrader).toBe(1);
  });
  it('does not enter during production energy shortage', () => {
    const { f } = economy(); f.room.energyAvailable = 200;
    expect(activate(f).targets.upgrader).toBe(1);
  });
  it('cancels extra spawning when armed enemies arrive', () => {
    const { f } = economy(); activate(f);
    const enemy = creep(f, 'defender', [ATTACK, MOVE]);
    delete Game.creeps[enemy.name]; f.hostiles.push(enemy);
    expect(planPopulation(inspectRoom(f.room)).targets.upgrader).toBe(1);
  });
  it('returns to storage policy once storage exists', () => {
    const { f } = economy(); activate(f);
    structure(f, STRUCTURE_STORAGE, 26, 25, 10000, 1000000);
    expect(planPopulation(inspectRoom(f.room)).targets.upgrader).toBe(1);
  });
  it('keeps one upgrader at RCL8', () => {
    const { f } = economy(); f.room.controller!.level = 8;
    expect(activate(f).targets.upgrader).toBe(1);
  });
  it('resets the waiting period after surplus disappears', () => {
    const { f, a, b } = economy(); planPopulation(inspectRoom(f.room));
    Game.time += 80; a.store.energy = b.store.energy = 100;
    planPopulation(inspectRoom(f.room));
    a.store.energy = b.store.energy = 1600; Game.time += 30;
    expect(planPopulation(inspectRoom(f.room)).targets.upgrader).toBe(1);
  });
  it('collects energy above the normal controller threshold without draining controller supply', () => {
    const { f } = economy(); activate(f);
    const supply = structure(f, STRUCTURE_CONTAINER, 39, 40, 700, 2000);
    const c = creep(f, 'hauler', [CARRY, MOVE]); RoleHauler.run(c);
    expect(c.withdraw).toHaveBeenCalled();
    expect(c.withdraw).not.toHaveBeenCalledWith(supply, RESOURCE_ENERGY);
  });
  it('supplies the larger buffer but still fills spawn first', () => {
    const { f } = economy(); activate(f);
    const supply = structure(f, STRUCTURE_CONTAINER, 39, 40, 700, 2000);
    const c = creep(f, 'hauler', [CARRY, MOVE], { store: store({ energy: 50 }, 50) });
    RoleHauler.run(c); expect(c.transfer).toHaveBeenCalledWith(supply, RESOURCE_ENERGY);
    const spawn = Object.values(Game.spawns)[0]; spawn.store.energy = 0;
    RoleHauler.run(c); expect(c.transfer).toHaveBeenLastCalledWith(spawn, RESOURCE_ENERGY);
  });
});
