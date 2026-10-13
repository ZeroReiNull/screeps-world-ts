export interface RoomState {
  room: Room;
  sources: Source[];
  structures: AnyStructure[];
  sites: ConstructionSite[];
  creeps: Creep[];
  hostiles: Creep[];
  containers: StructureContainer[];
  towers: StructureTower[];
  spawns: StructureSpawn[];
}
export function inspectRoom(room: Room): RoomState {
  const structures = room.find(FIND_STRUCTURES);
  return {
    room, structures, sources: room.find(FIND_SOURCES), sites: room.find(FIND_MY_CONSTRUCTION_SITES),
    creeps: Object.values(Game.creeps).filter(c => (c.memory.home ?? c.room.name) === room.name),
    hostiles: room.find(FIND_HOSTILE_CREEPS),
    containers: structures.filter((s): s is StructureContainer => s.structureType === STRUCTURE_CONTAINER),
    towers: structures.filter((s): s is StructureTower => s.structureType === STRUCTURE_TOWER && s.my && s.isActive()),
    spawns: Object.values(Game.spawns).filter(s => s.room.name === room.name),
  };
}
export function sourceContainer(state: RoomState, source: Source): StructureContainer | undefined {
  return state.containers.find(c => c.pos.inRangeTo(source, 1));
}
export function threatPower(hostiles: Creep[]): number {
  return hostiles.reduce((n, c) => n + c.getActiveBodyparts(ATTACK) * 30
    + c.getActiveBodyparts(RANGED_ATTACK) * 10 + c.getActiveBodyparts(HEAL) * 24
    + c.getActiveBodyparts(WORK) * 10, 0);
}
export function economicCreep(c: Creep): boolean {
  const travel = c.memory.role === 'miner' ? 40 : 20;
  return c.spawning || c.ticksToLive === undefined || c.ticksToLive > c.body.length * CREEP_SPAWN_TIME + travel;
}
