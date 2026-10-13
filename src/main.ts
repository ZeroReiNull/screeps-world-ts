import { memory } from './core/memory';
import { spawn } from './core/spawn';
import { inspectRoom } from './core/room';
import { planRoom } from './core/planner';
import { runDefense } from './core/defense';
import { runStructures } from './core/structures';
import { RoleWorker } from './roles/RoleWorker';
import { RoleMiner } from './roles/RoleMiner';
import { RoleHauler } from './roles/RoleHauler';
import { RoleUpgrader } from './roles/RoleUpgrader';
import { RoleDefender } from './roles/RoleDefender';
import { RoleMineralMiner } from './roles/RoleMineralMiner';
import { CONFIG, type Role } from './config';
const roles: Record<Role, { run(creep: Creep): void }> = {
  worker: RoleWorker,
  miner: RoleMiner,
  hauler: RoleHauler,
  upgrader: RoleUpgrader,
  defender: RoleDefender,
  mineralMiner: RoleMineralMiner,
};
function guard(label: string, task: () => void): void {
  try {
    task();
  } catch (error) {
    if (Game.time % 25 === 0)
      console.log(`[${label}] ${error instanceof Error ? error.stack : String(error)}`);
  }
}
export function loop(): void {
  memory.clearDeadCreeps();
  for (const room of Object.values(Game.rooms)) {
    if (!room.controller?.my) continue;
    guard(room.name, () => {
      const state = inspectRoom(room);
      guard(`${room.name}/defense`, () => runDefense(state));
      guard(`${room.name}/structures`, () => runStructures(state));
      guard(`${room.name}/spawn`, () => spawn.runRoom(state));
      if (Game.cpu.bucket > 1000) guard(`${room.name}/planner`, () => planRoom(state));
    });
  }
  for (const creep of Object.values(Game.creeps)) {
    if (creep.spawning) continue;
    if (!roles[creep.memory.role]) creep.memory.role = 'worker';
    guard(creep.name, () => roles[creep.memory.role].run(creep));
  }
  if (
    CONFIG.generatePixel &&
    typeof Game.cpu.generatePixel === 'function' &&
    Game.cpu.bucket >= 10000
  )
    Game.cpu.generatePixel();
}
