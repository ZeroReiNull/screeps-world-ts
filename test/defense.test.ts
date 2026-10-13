import { describe, it, expect } from 'vitest';
import { fixture, structure, spawner, creep, pos } from './mock';
import { inspectRoom } from '../src/core/room';
import { runDefense } from '../src/core/defense';
import { RoleDefender } from '../src/roles/RoleDefender';
describe('defense', () => {
  it('concentrates tower fire on healers', () => {
    const f = fixture(3);
    const tower = structure<StructureTower>(f, STRUCTURE_TOWER, 25, 25, 1000);
    const attacker = creep(f, 'defender', [ATTACK], { pos: pos(26, 25) }),
      healer = creep(f, 'defender', [HEAL], { pos: pos(28, 25) });
    delete Game.creeps[attacker.name];
    delete Game.creeps[healer.name];
    f.hostiles.push(attacker, healer);
    runDefense(inspectRoom(f.room));
    expect(tower.attack).toHaveBeenCalledWith(healer);
    expect(tower.repair).not.toHaveBeenCalled();
  });
  it('heals friendlies in peace', () => {
    const f = fixture(3);
    const tower = structure<StructureTower>(f, STRUCTURE_TOWER, 25, 25, 1000);
    const ally = creep(f, 'worker', [WORK], { hits: 200 });
    runDefense(inspectRoom(f.room));
    expect(tower.heal).toHaveBeenCalledWith(ally);
  });
  it('preserves low tower energy instead of repairing walls', () => {
    const f = fixture(3);
    const tower = structure<StructureTower>(f, STRUCTURE_TOWER, 25, 25, 600);
    const wall = structure(f, STRUCTURE_WALL);
    wall.hits = 1;
    runDefense(inspectRoom(f.room));
    expect(tower.repair).not.toHaveBeenCalled();
  });
  it('activates safe mode only for armed enemies near vital structures', () => {
    const f = fixture(3);
    spawner(f);
    const enemy = creep(f, 'defender', [ATTACK], { pos: pos(3, 3) });
    delete Game.creeps[enemy.name];
    f.hostiles.push(enemy);
    runDefense(inspectRoom(f.room));
    expect(f.room.controller!.activateSafeMode).not.toHaveBeenCalled();
    enemy.pos = pos(26, 25);
    runDefense(inspectRoom(f.room));
    expect(f.room.controller!.activateSafeMode).toHaveBeenCalledOnce();
  });
  it('does not waste safe mode on a scout or while cooling down', () => {
    const f = fixture(3);
    spawner(f);
    const enemy = creep(f, 'defender', [MOVE]);
    delete Game.creeps[enemy.name];
    f.hostiles.push(enemy);
    runDefense(inspectRoom(f.room));
    expect(f.room.controller!.activateSafeMode).not.toHaveBeenCalled();
    f.room.controller!.safeModeCooldown = 100;
    runDefense(inspectRoom(f.room));
    expect(f.room.controller!.activateSafeMode).not.toHaveBeenCalled();
  });
  it('a guard attacks in range and heals itself', () => {
    const f = fixture(3);
    const guard = creep(f, 'defender', [RANGED_ATTACK, HEAL, MOVE, MOVE], { hits: 500 });
    const enemy = creep(f, 'defender', [ATTACK], { pos: pos(28, 25) });
    delete Game.creeps[enemy.name];
    f.hostiles.push(enemy);
    RoleDefender.run(guard);
    expect(guard.rangedAttack).toHaveBeenCalledWith(enemy);
    expect(guard.heal).toHaveBeenCalledWith(guard);
  });
});
