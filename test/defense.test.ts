import { describe,it,expect } from 'vitest';
import { fixture,structure,spawner,creep,pos } from './mock';
import { inspectRoom } from '../src/core/room';
import { runDefense } from '../src/core/defense';
import { RoleDefender } from '../src/roles/RoleDefender';
describe('defense',()=>{
  it('concentrates tower fire on healers',()=>{
    const f=fixture(3);const tower=structure<StructureTower>(f,STRUCTURE_TOWER,25,25,1000);
    const attacker=creep(f,'defender',[ATTACK],{pos:pos(26,25)}),healer=creep(f,'defender',[HEAL],{pos:pos(28,25)});
    delete Game.creeps[attacker.name];delete Game.creeps[healer.name];f.hostiles.push(attacker,healer);
    runDefense(inspectRoom(f.room));expect(tower.attack).toHaveBeenCalledWith(healer);expect(tower.repair).not.toHaveBeenCalled();
  });
  it('heals friendlies in peace',()=>{
    const f=fixture(3);const tower=structure<StructureTower>(f,STRUCTURE_TOWER,25,25,1000);
    const ally=creep(f,'worker',[WORK],{hits:200});runDefense(inspectRoom(f.room));expect(tower.heal).toHaveBeenCalledWith(ally);
  });
  it('preserves low tower energy instead of repairing walls',()=>{
    const f=fixture(3);const tower=structure<StructureTower>(f,STRUCTURE_TOWER,25,25,600);
    const wall=structure(f,STRUCTURE_WALL);wall.hits=1;runDefense(inspectRoom(f.room));expect(tower.repair).not.toHaveBeenCalled();
  });
  it('activates safe mode only for armed enemies near vital structures',()=>{
    const f=fixture(3);spawner(f);const enemy=creep(f,'defender',[ATTACK],{pos:pos(3,3)});delete Game.creeps[enemy.name];f.hostiles.push(enemy);
    runDefense(inspectRoom(f.room));expect(f.room.controller!.activateSafeMode).not.toHaveBeenCalled();
    enemy.pos=pos(26,25);runDefense(inspectRoom(f.room));expect(f.room.controller!.activateSafeMode).toHaveBeenCalledOnce();
  });
  it('does not waste safe mode on a scout or while cooling down',()=>{
    const f=fixture(3);spawner(f);const enemy=creep(f,'defender',[MOVE]);delete Game.creeps[enemy.name];f.hostiles.push(enemy);
    runDefense(inspectRoom(f.room));expect(f.room.controller!.activateSafeMode).not.toHaveBeenCalled();
    f.room.controller!.safeModeCooldown=100;runDefense(inspectRoom(f.room));expect(f.room.controller!.activateSafeMode).not.toHaveBeenCalled();
  });
  it('a guard attacks in range and heals itself',()=>{
    const f=fixture(3);const guard=creep(f,'defender',[RANGED_ATTACK,HEAL,MOVE,MOVE],{hits:500});
    const enemy=creep(f,'defender',[ATTACK],{pos:pos(28,25)});delete Game.creeps[enemy.name];f.hostiles.push(enemy);
    RoleDefender.run(guard);expect(guard.rangedAttack).toHaveBeenCalledWith(enemy);expect(guard.heal).toHaveBeenCalledWith(guard);
  });
});

describe('defensive positioning and economy protection', () => {
  function enemy(f: ReturnType<typeof fixture>, x: number, y: number, parts = [ATTACK, MOVE] as BodyPartConstant[]) {
    const c = creep(f, 'defender', parts, { pos: pos(x, y) });
    delete Game.creeps[c.name]; f.hostiles.push(c); return c;
  }
  it('does not chase distant attackers away from base', () => {
    const f = fixture(3); spawner(f);
    const guard = creep(f, 'defender', [RANGED_ATTACK, MOVE]); enemy(f, 5, 5);
    RoleDefender.run(guard);
    expect(guard.moveTo).not.toHaveBeenCalled();
  });
  it('occupies a walkable rampart in firing range', () => {
    const f = fixture(3); spawner(f);
    const guard = creep(f, 'defender', [RANGED_ATTACK, MOVE]);
    const cover = structure(f, STRUCTURE_RAMPART, 26, 26);
    enemy(f, 28, 26); RoleDefender.run(guard);
    expect(guard.moveTo).toHaveBeenCalledWith(cover, expect.objectContaining({ range: 0 }));
  });
  it('does not try to stand on a rampart covering a spawn', () => {
    const f = fixture(3); spawner(f); structure(f, STRUCTURE_RAMPART, 25, 25);
    const guard = creep(f, 'defender', [RANGED_ATTACK, MOVE]); enemy(f, 28, 25);
    RoleDefender.run(guard); expect(guard.moveTo).not.toHaveBeenCalled();
  });
  it('holds its rampart against nearby melee attackers', () => {
    const f = fixture(3); spawner(f); structure(f, STRUCTURE_RAMPART, 26, 26);
    const guard = creep(f, 'defender', [RANGED_ATTACK, MOVE], { pos: pos(26,26) });
    const attacker = enemy(f, 27, 26); RoleDefender.run(guard);
    expect(guard.rangedAttack).toHaveBeenCalledWith(attacker);
    expect(guard.move).not.toHaveBeenCalled(); expect(guard.moveTo).not.toHaveBeenCalled();
  });
  it('shoots an in-range attacker instead of chasing a distant healer', () => {
    const f = fixture(3); spawner(f);
    const guard = creep(f, 'defender', [RANGED_ATTACK, MOVE]);
    const attacker = enemy(f, 28, 25); enemy(f, 5, 5, [HEAL, MOVE]);
    RoleDefender.run(guard); expect(guard.rangedAttack).toHaveBeenCalledWith(attacker);
  });
  it('protects multiple injured economic creeps away from the spawn with safe mode', () => {
    const f = fixture(2); spawner(f);
    creep(f, 'miner', [WORK, MOVE], {pos:pos(10,10),hits:100});
    creep(f, 'hauler', [CARRY, MOVE], {pos:pos(11,10),hits:100});
    enemy(f, 10,11); runDefense(inspectRoom(f.room));
    expect(f.room.controller!.activateSafeMode).toHaveBeenCalledOnce();
  });
  it('does not use safe mode for unharmed economic creeps near an enemy', () => {
    const f = fixture(2); spawner(f);
    creep(f, 'miner', [WORK,MOVE], {pos:pos(10,10)});
    enemy(f,10,11); runDefense(inspectRoom(f.room));
    expect(f.room.controller!.activateSafeMode).not.toHaveBeenCalled();
  });
});
