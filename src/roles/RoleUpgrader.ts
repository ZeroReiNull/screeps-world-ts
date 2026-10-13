import { acquireEnergy, goHome, upgrade, working } from '../core/actions';
import { settings } from '../config';
export class RoleUpgrader {
  static run(creep: Creep): void {
    if (goHome(creep)) return;
    if (!working(creep)) {
      const controller = creep.room.controller;
      const link = controller?.pos.findInRange(FIND_MY_STRUCTURES, 3, {
        filter: s => s.structureType === STRUCTURE_LINK && s.store[RESOURCE_ENERGY] > 0,
      })[0] as StructureLink | undefined;
      if (link) {
        if (creep.withdraw(link, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) creep.moveTo(link, { reusePath: 10 });
      } else acquireEnergy(creep, true, controller && controller.ticksToDowngrade < 5000 ? 0 : settings(creep.room).storageReserve);
      return;
    }
    upgrade(creep);
  }
}
