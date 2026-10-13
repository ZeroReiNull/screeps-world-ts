export const ROLE_WORKER = 'worker';
export const ROLE_MINER = 'miner';
export type Role = 'worker' | 'miner' | 'hauler' | 'upgrader' | 'defender' | 'mineralMiner';

/** Defaults can be overridden independently for each owned room in Memory.rooms. */
export const CONFIG = {
  autoBuild: true,
  planInterval: 100,
  maxRoomSites: 12,
  maxNewSites: 4,
  storageReserve: 20000,
  upgradeSurplus: 60000,
  mineralCap: 50000,
  maxDefenders: 4,
  towerRepairReserve: 700,
  generatePixel: false,
};
export function settings(room: Room) {
  return { ...CONFIG, ...room.memory.settings };
}
