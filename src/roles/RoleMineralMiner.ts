import { goHome, move } from '../core/actions';
import { settings } from '../config';
export class RoleMineralMiner {
  static run(creep: Creep): void {
    if (goHome(creep)) return;
    const mineral = creep.memory.mineralId && Game.getObjectById(creep.memory.mineralId);
    if (!mineral || !mineral.mineralAmount || !creep.room.storage) return;
    if ((creep.room.storage.store[mineral.mineralType] ?? 0) >= settings(creep.room).mineralCap
      || creep.room.storage.store.getFreeCapacity() < 10000) return;
    const container = mineral.pos.findInRange(FIND_STRUCTURES, 1, { filter: s => s.structureType === STRUCTURE_CONTAINER })[0] as StructureContainer | undefined;
    if (!container) return;
    if (!creep.pos.isEqualTo(container.pos)) { move(creep, container, 0); return; }
    if (creep.store[mineral.mineralType]) creep.transfer(container, mineral.mineralType);
    if (container.store.getFreeCapacity() > 0) {
      const extractor = mineral.pos.lookFor(LOOK_STRUCTURES).find(s => s.structureType === STRUCTURE_EXTRACTOR) as StructureExtractor | undefined;
      if (extractor && !extractor.cooldown) creep.harvest(mineral);
    }
  }
}
