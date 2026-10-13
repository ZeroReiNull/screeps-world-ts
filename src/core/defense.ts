import { settings } from '../config';
import { repairLimit } from './actions';
import { threatPower, type RoomState } from './room';
export function runDefense(state: RoomState): void {
  const { room, towers, hostiles } = state;
  const cfg = settings(room);
  const healers = hostiles.filter(c => c.getActiveBodyparts(HEAL) > 0);
  for (const tower of towers) {
    if (tower.store[RESOURCE_ENERGY] < TOWER_ENERGY_COST) continue;
    if (hostiles.length) {
      const target = tower.pos.findClosestByRange(healers.length ? healers : hostiles);
      if (target) tower.attack(target);
      continue;
    }
    const injured = tower.pos.findClosestByRange(state.creeps.filter(c => c.hits < c.hitsMax));
    if (injured) { tower.heal(injured); continue; }
    if (tower.store[RESOURCE_ENERGY] < cfg.towerRepairReserve || Game.time % 10 !== 0) continue;
    const repair = tower.pos.findClosestByRange(state.structures.filter(s => s.hits < repairLimit(s, room)));
    if (repair) tower.repair(repair);
  }
  const controller = room.controller;
  if (!controller?.my || controller.safeMode || controller.safeModeCooldown || !controller.safeModeAvailable
    || controller.upgradeBlocked || !threatPower(hostiles)) return;
  const critical = state.structures.filter(s => 'my' in s && s.my
    && (s.structureType === STRUCTURE_SPAWN || s.structureType === STRUCTURE_STORAGE || s.structureType === STRUCTURE_TOWER));
  // Safe mode is a last line of defense when armed enemies reach essential structures.
  const danger = hostiles.some(c => threatPower([c]) > 0 && critical.some(s => c.pos.inRangeTo(s, 3)));
  if (danger) {
    const result = controller.activateSafeMode();
    if (result === OK) console.log(`[defense ${room.name}] Safe mode activated`);
  }
}
