import { goHome, move } from '../core/actions';
export class RoleDefender {
  static run(creep: Creep): void {
    if (goHome(creep)) return;
    const hostiles = creep.room.find(FIND_HOSTILE_CREEPS);
    const healers = hostiles.filter((c) => c.getActiveBodyparts(HEAL) > 0);
    const target = creep.pos.findClosestByRange(healers.length ? healers : hostiles);
    if (creep.getActiveBodyparts(HEAL)) {
      if (creep.hits < creep.hitsMax) creep.heal(creep);
      else {
        const ally = creep.pos.findClosestByRange(FIND_MY_CREEPS, {
          filter: (c) => c.hits < c.hitsMax,
        });
        if (ally && creep.pos.inRangeTo(ally, 1)) creep.heal(ally);
        else if (ally && creep.pos.inRangeTo(ally, 3)) creep.rangedHeal(ally);
      }
    }
    if (!target) {
      const spawn = Object.values(Game.spawns).find((s) => s.room.name === creep.room.name);
      if (spawn && !creep.pos.inRangeTo(spawn, 4)) move(creep, spawn, 4);
      return;
    }
    const range = creep.pos.getRangeTo(target);
    if (range <= 3) creep.rangedAttack(target);
    if (range < 3 && target.getActiveBodyparts(ATTACK) > 0) {
      const escape = PathFinder.search(
        creep.pos,
        hostiles.map((c) => ({ pos: c.pos, range: 3 })),
        { flee: true, maxRooms: 1 },
      );
      if (escape.path.length) creep.move(creep.pos.getDirectionTo(escape.path[0]));
    } else if (range > 3) move(creep, target, 3);
  }
}
