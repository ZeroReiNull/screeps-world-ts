import {
  acquireEnergy,
  goHome,
  move,
  refill,
  repairLimit,
  upgrade,
  working,
} from '../core/actions';
export class RoleWorker {
  static run(creep: Creep): void {
    if (goHome(creep)) return;
    if (!working(creep)) {
      acquireEnergy(creep, true);
      return;
    }
    const controller = creep.room.controller;
    if (controller?.my && controller.ticksToDowngrade < 5000) {
      upgrade(creep);
      return;
    }
    if (refill(creep)) return;
    // Critical structural damage first, construction before routine repairs.
    const critical = creep.pos.findClosestByPath(FIND_STRUCTURES, {
      filter: (s) =>
        (s.structureType === STRUCTURE_CONTAINER || s.structureType === STRUCTURE_RAMPART) &&
        s.hits < 3000 &&
        repairLimit(s, creep.room) > s.hits,
    });
    if (critical) {
      if (creep.repair(critical) === ERR_NOT_IN_RANGE) move(creep, critical, 3);
      return;
    }
    const sites = creep.room.find(FIND_MY_CONSTRUCTION_SITES);
    const essential = sites.filter(
      (s) =>
        s.structureType === STRUCTURE_SPAWN ||
        s.structureType === STRUCTURE_TOWER ||
        s.structureType === STRUCTURE_EXTENSION ||
        s.structureType === STRUCTURE_CONTAINER,
    );
    const site = creep.pos.findClosestByPath(essential.length ? essential : sites);
    if (site) {
      if (creep.build(site) === ERR_NOT_IN_RANGE) move(creep, site, 3);
      return;
    }
    const repair = creep.pos.findClosestByPath(FIND_STRUCTURES, {
      filter: (s) => s.hits < repairLimit(s, creep.room),
    });
    if (repair) {
      if (creep.repair(repair) === ERR_NOT_IN_RANGE) move(creep, repair, 3);
      return;
    }
    upgrade(creep);
  }
}
