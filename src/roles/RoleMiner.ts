import { goHome, move } from '../core/actions';
export class RoleMiner {
  static run(creep: Creep): void {
    if (goHome(creep)) return;
    if (!creep.memory.sourceId) {
      const sources = creep.room.find(FIND_SOURCES);
      const source = sources.find(s => !Object.values(Game.creeps).some(c => c.name !== creep.name
        && c.memory.role === 'miner' && c.memory.sourceId === s.id)) ?? sources[0];
      if (source) creep.memory.sourceId = source.id;
    }
    const source = creep.memory.sourceId && Game.getObjectById(creep.memory.sourceId);
    if (!source) { delete creep.memory.sourceId; return; }
    const container = source.pos.findInRange(FIND_STRUCTURES, 1, {
      filter: s => s.structureType === STRUCTURE_CONTAINER,
    })[0] as StructureContainer | undefined;
    // Partial miners at low RCL share the source, without trying to stand on the same tile.
    const first = Object.values(Game.creeps).find(c => !c.spawning && c.memory.role === 'miner'
      && c.memory.sourceId === source.id);
    if (container && first?.name === creep.name && !creep.pos.isEqualTo(container.pos)) {
      move(creep, container, 0); return;
    }
    if (!creep.pos.inRangeTo(source, 1)) { move(creep, source); return; }
    const link = source.pos.findInRange(FIND_MY_STRUCTURES, 2, {
      filter: s => s.structureType === STRUCTURE_LINK && s.isActive(),
    }).find(s => creep.pos.inRangeTo(s, 1)) as StructureLink | undefined;
    if (creep.store[RESOURCE_ENERGY] > 0) {
      if (container && container.hits < container.hitsMax - 5000) { creep.repair(container); return; }
      if (link && link.store.getFreeCapacity(RESOURCE_ENERGY) > 0) creep.transfer(link, RESOURCE_ENERGY);
      else if (container && creep.pos.inRangeTo(container, 1) && container.store.getFreeCapacity() > 0) creep.transfer(container, RESOURCE_ENERGY);
      else creep.drop(RESOURCE_ENERGY);
    }
    creep.harvest(source);
  }
}
