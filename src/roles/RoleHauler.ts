import { acquireEnergy, goHome, move, refill, working } from '../core/actions';
import { settings } from '../config';
export class RoleHauler {
  static run(creep: Creep): void {
    if (goHome(creep)) return;
    const room = creep.room;
    if (!working(creep, true)) {
      if (Object.keys(creep.store).some(r => r !== RESOURCE_ENERGY && creep.store[r as ResourceConstant] > 0)) creep.memory.working = true;
    }
    if (!creep.memory.working) {
      // Partial loads must be delivered when spawn/tower energy is urgent.
      if (creep.store[RESOURCE_ENERGY] > 0 && room.energyAvailable < room.energyCapacityAvailable) {
        creep.memory.working = true;
      } else {
        const urgent = room.energyAvailable < room.energyCapacityAvailable
          || room.find(FIND_MY_STRUCTURES).some(s => s.structureType === STRUCTURE_TOWER && s.store[RESOURCE_ENERGY] < 850);
        const controllerDemand = room.controller?.pos.findInRange(FIND_STRUCTURES, 3, { filter: s =>
          (s.structureType === STRUCTURE_CONTAINER || s.structureType === STRUCTURE_LINK) && s.store[RESOURCE_ENERGY] < 500 }).length;
        const stored = room.storage?.store[RESOURCE_ENERGY] ?? 0;
        const canUseStorage = urgent || (stored > settings(room).storageReserve && !!controllerDemand)
          || (stored > settings(room).upgradeSurplus && !!room.terminal && room.terminal.store[RESOURCE_ENERGY] < 10000);
        if (!urgent && room.storage && room.storage.store.getFreeCapacity() > 1000) {
          const minerals = room.find(FIND_STRUCTURES).filter((s): s is StructureContainer =>
            s.structureType === STRUCTURE_CONTAINER && s.store.getUsedCapacity() > s.store[RESOURCE_ENERGY]);
          const mineralContainer = creep.pos.findClosestByPath(minerals);
          if (mineralContainer) {
            const resource = Object.keys(mineralContainer.store).find(r => r !== RESOURCE_ENERGY && mineralContainer.store[r as ResourceConstant] > 0) as ResourceConstant | undefined;
            if (resource && creep.withdraw(mineralContainer, resource) === ERR_NOT_IN_RANGE) move(creep, mineralContainer);
            if (resource) return;
          }
        }
        const hasEnergy = room.find(FIND_DROPPED_RESOURCES).some(r => r.resourceType === RESOURCE_ENERGY && r.amount >= 20)
          || room.find(FIND_STRUCTURES).some(s => s.structureType === STRUCTURE_CONTAINER && s.store[RESOURCE_ENERGY] > 0
            && (!room.controller?.pos.inRangeTo(s, 3) || room.find(FIND_SOURCES).some(source => source.pos.inRangeTo(s, 1))))
          || (canUseStorage && stored > 0);
        if (hasEnergy && (urgent || room.storage || controllerDemand)) {
          acquireEnergy(creep, false, canUseStorage ? 0 : Infinity, true); return;
        }
        const mineral = creep.pos.findClosestByPath(FIND_DROPPED_RESOURCES, { filter: r => r.resourceType !== RESOURCE_ENERGY });
        if (mineral && room.storage && room.storage.store.getFreeCapacity() > 0) {
          if (creep.pickup(mineral) === ERR_NOT_IN_RANGE) move(creep, mineral); return;
        }
        const deposit = creep.pos.findClosestByPath(FIND_STRUCTURES, { filter: s => s.structureType === STRUCTURE_CONTAINER
          && s.store.getUsedCapacity() > (s.store[RESOURCE_ENERGY] ?? 0) });
        if (deposit && room.storage && room.storage.store.getFreeCapacity() > 0) {
          const resource = Object.keys((deposit as StructureContainer).store).find(r => r !== RESOURCE_ENERGY) as ResourceConstant;
          if (resource && creep.withdraw(deposit, resource) === ERR_NOT_IN_RANGE) move(creep, deposit);
          return;
        }
        // When idle, fill terminal mineral reserves from storage. No market orders or sales.
        if (room.storage && room.terminal && room.terminal.store.getFreeCapacity() > 1000) {
          const resource = Object.keys(room.storage.store).find(r => r !== RESOURCE_ENERGY
            && (room.terminal!.store[r as ResourceConstant] ?? 0) < 5000) as ResourceConstant | undefined;
          if (resource) {
            if (creep.withdraw(room.storage, resource, Math.min(creep.store.getFreeCapacity(), 5000 - (room.terminal.store[resource] ?? 0), room.storage.store[resource])) === ERR_NOT_IN_RANGE) move(creep, room.storage);
            return;
          }
        }
        if (creep.store.getUsedCapacity() > 0) creep.memory.working = true;
        else return;
      }
    }
    const mineral = Object.keys(creep.store).find(r => r !== RESOURCE_ENERGY && creep.store[r as ResourceConstant] > 0) as ResourceConstant | undefined;
    if (mineral) {
      const target = room.terminal && (room.terminal.store[mineral] ?? 0) < 5000 && room.terminal.store.getFreeCapacity() > 0 ? room.terminal : room.storage;
      if (target && target.store.getFreeCapacity() > 0 && creep.transfer(target, mineral) === ERR_NOT_IN_RANGE) move(creep, target);
      return;
    }
    if (refill(creep)) return;
    const cfg = settings(room);
    const controller = room.controller;
    const controllerSupply = controller?.pos.findInRange(FIND_STRUCTURES, 3, {
      filter: s => (s.structureType === STRUCTURE_CONTAINER || s.structureType === STRUCTURE_LINK)
        && s.store[RESOURCE_ENERGY] < 500 && s.store.getFreeCapacity(RESOURCE_ENERGY) > 0,
    })[0] as StructureContainer | StructureLink | undefined;
    if (controllerSupply && (!room.storage || room.storage.store[RESOURCE_ENERGY] > cfg.storageReserve || controller!.ticksToDowngrade < 5000)) {
      if (creep.transfer(controllerSupply, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) move(creep, controllerSupply); return;
    }
    const terminal = room.terminal;
    if (terminal && terminal.store[RESOURCE_ENERGY] < 10000 && (room.storage?.store[RESOURCE_ENERGY] ?? 0) > cfg.upgradeSurplus) {
      if (creep.transfer(terminal, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) move(creep, terminal); return;
    }
    if (room.storage && room.storage.store.getFreeCapacity() > 0) {
      if (creep.transfer(room.storage, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) move(creep, room.storage);
    } else {
      // Before RCL4 feed upgrade/build workers directly rather than dropping energy in a loop.
      const consumer = creep.pos.findClosestByPath(FIND_MY_CREEPS, { filter: c => c.name !== creep.name
        && (c.memory.role === 'worker' || c.memory.role === 'upgrader') && c.store.getFreeCapacity(RESOURCE_ENERGY) > 0 });
      if (consumer && creep.transfer(consumer, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) move(creep, consumer);
    }
  }
}
