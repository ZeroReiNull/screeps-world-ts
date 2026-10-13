import { settings } from '../config';
export function move(creep: Creep, target: RoomPosition | { pos: RoomPosition }, range = 1): void {
  creep.moveTo(target, { range, reusePath: 10, maxRooms: 1 });
}
export function goHome(creep: Creep): boolean {
  if (creep.memory.home && creep.room.name !== creep.memory.home) {
    creep.moveTo(new RoomPosition(25, 25, creep.memory.home), { reusePath: 20 });
    return true;
  }
  return false;
}
export function working(creep: Creep, allResources = false): boolean {
  const used = allResources ? creep.store.getUsedCapacity() : creep.store[RESOURCE_ENERGY];
  if (used === 0) creep.memory.working = false;
  else if (creep.store.getFreeCapacity() === 0) creep.memory.working = true;
  return creep.memory.working;
}
export function acquireEnergy(
  creep: Creep,
  canHarvest: boolean,
  reserve = 0,
  hauling = false,
): void {
  const dropped = creep.pos.findClosestByPath(FIND_DROPPED_RESOURCES, {
    filter: (r) => r.resourceType === RESOURCE_ENERGY && r.amount >= 20,
  });
  if (dropped) {
    if (creep.pickup(dropped) === ERR_NOT_IN_RANGE) move(creep, dropped);
    return;
  }
  const remains = [...creep.room.find(FIND_TOMBSTONES), ...creep.room.find(FIND_RUINS)].filter(
    (r) => r.store[RESOURCE_ENERGY] > 0,
  );
  const remnant = creep.pos.findClosestByPath(remains);
  if (remnant) {
    if (creep.withdraw(remnant, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) move(creep, remnant);
    return;
  }
  const deposits = creep.room.find(FIND_STRUCTURES, {
    filter: (s) =>
      (s.structureType === STRUCTURE_CONTAINER &&
        s.store[RESOURCE_ENERGY] > 0 &&
        (!hauling ||
          !creep.room.controller?.pos.inRangeTo(s, 3) ||
          creep.room.find(FIND_SOURCES).some((source) => source.pos.inRangeTo(s, 1)))) ||
      (s.structureType === STRUCTURE_STORAGE && s.my && s.store[RESOURCE_ENERGY] > reserve),
  }) as (StructureContainer | StructureStorage)[];
  const deposit = creep.pos.findClosestByPath(deposits);
  if (deposit) {
    if (creep.withdraw(deposit, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) move(creep, deposit);
    return;
  }
  if (canHarvest) {
    const sources = creep.room.find(FIND_SOURCES).filter((s) => s.energy > 0);
    const counts = (s: Source) =>
      Object.values(Game.creeps).filter((c) => c.memory.sourceId === s.id && c.name !== creep.name)
        .length;
    const ordered = sources.sort(
      (a, b) => counts(a) - counts(b) || creep.pos.getRangeTo(a) - creep.pos.getRangeTo(b),
    );
    const source = ordered[0];
    if (source) {
      creep.memory.sourceId = source.id;
      if (creep.harvest(source) === ERR_NOT_IN_RANGE) move(creep, source);
      return;
    }
  }
  // Do not wait forever to fill a body when only small intermittent amounts are available.
  if (creep.store[RESOURCE_ENERGY] > 0) creep.memory.working = true;
}
export function refill(creep: Creep): boolean {
  const threats = creep.room.find(FIND_HOSTILE_CREEPS).length > 0;
  const structures = creep.room.find(FIND_MY_STRUCTURES);
  const targets = structures.filter(
    (s): s is StructureSpawn | StructureExtension | StructureTower =>
      ((s.structureType === STRUCTURE_SPAWN || s.structureType === STRUCTURE_EXTENSION) &&
        s.store.getFreeCapacity(RESOURCE_ENERGY) > 0) ||
      (s.structureType === STRUCTURE_TOWER && s.store[RESOURCE_ENERGY] < (threats ? 1000 : 850)),
  );
  const priority = targets.filter((s) =>
    threats ? s.structureType === STRUCTURE_TOWER : s.structureType !== STRUCTURE_TOWER,
  );
  const target = creep.pos.findClosestByPath(priority.length ? priority : targets);
  if (!target) return false;
  if (creep.transfer(target, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) move(creep, target);
  return true;
}
export function upgrade(creep: Creep): void {
  const controller = creep.room.controller;
  if (controller?.my && creep.upgradeController(controller) === ERR_NOT_IN_RANGE)
    move(creep, controller, 3);
}
export function repairLimit(s: AnyStructure, room: Room): number {
  if ('my' in s && !s.my) return 0;
  if (s.structureType === STRUCTURE_WALL || s.structureType === STRUCTURE_RAMPART) {
    const stored = room.storage?.store[RESOURCE_ENERGY] ?? 0;
    return Math.min(
      s.hitsMax,
      stored > settings(room).upgradeSurplus ? (room.controller?.level ?? 1) * 100000 : 10000,
    );
  }
  return s.hitsMax * (s.structureType === STRUCTURE_ROAD ? 0.6 : 0.8);
}
