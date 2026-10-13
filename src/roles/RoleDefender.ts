import { goHome, move } from '../core/actions';
import { protectedAt } from '../core/safety';
export class RoleDefender {
  static run(creep: Creep): void {
    if (goHome(creep)) return;
    const hostiles = creep.room.find(FIND_HOSTILE_CREEPS);
    const anchor =
      creep.room.storage ?? Object.values(Game.spawns).find((s) => s.room.name === creep.room.name);
    const structures = creep.room.find(FIND_MY_STRUCTURES);
    const towers = structures.filter(
      (s): s is StructureTower =>
        s.structureType === STRUCTURE_TOWER &&
        s.isActive() &&
        s.store[RESOURCE_ENERGY] >= TOWER_ENERGY_COST,
    );
    const nearby = hostiles.filter((enemy) => creep.pos.inRangeTo(enemy, 3));
    const candidates = nearby.length
      ? nearby
      : hostiles.filter(
          (enemy) =>
            (anchor && anchor.pos.inRangeTo(enemy, 8)) ||
            towers.some((t) => t.pos.inRangeTo(enemy, 8)),
        );
    const healers = candidates.filter((c) => c.getActiveBodyparts(HEAL) > 0);
    const target = creep.pos.findClosestByRange(healers.length ? healers : candidates);
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
    if (creep.room.controller?.safeMode) return;
    const allies = creep.room.find(FIND_MY_CREEPS);
    const rampart = creep.pos.findClosestByPath(
      structures.filter(
        (s) =>
          s.structureType === STRUCTURE_RAMPART &&
          s.hits > 0 &&
          s.pos.inRangeTo(target, 3) &&
          ((anchor && s.pos.inRangeTo(anchor, 8)) || towers.some((t) => s.pos.inRangeTo(t, 8))) &&
          !allies.some((c) => c.name !== creep.name && c.pos.isEqualTo(s.pos)) &&
          !structures.some(
            (other) =>
              other.pos.isEqualTo(s.pos) &&
              (OBSTACLE_OBJECT_TYPES as readonly string[]).includes(other.structureType),
          ),
      ),
    );
    if (protectedAt(creep)) return;
    if (rampart) {
      move(creep, rampart, 0);
      return;
    }
    if (
      range < 3 &&
      hostiles.some(
        (enemy) => enemy.getActiveBodyparts(ATTACK) > 0 && creep.pos.inRangeTo(enemy, 2),
      )
    ) {
      const escape = PathFinder.search(
        creep.pos,
        hostiles.map((c) => ({ pos: c.pos, range: 3 })),
        { flee: true, maxRooms: 1 },
      );
      if (escape.path.length) creep.move(creep.pos.getDirectionTo(escape.path[0]));
    } else if (range > 3) {
      // Hold the base instead of chasing outside tower coverage.
      if (anchor && !creep.pos.inRangeTo(anchor, 4)) move(creep, anchor, 4);
    }
  }
}
