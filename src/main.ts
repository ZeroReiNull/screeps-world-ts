import { optionalTask, finishCpu } from './core/cpu';
import type { RoomState } from './core/room';
import { retreatEconomy } from './core/safety';
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
import { type Role } from './config';
const roles: Record<Role, { run(creep: Creep): void }> = {
  worker: RoleWorker, miner: RoleMiner, hauler: RoleHauler, upgrader: RoleUpgrader,
  defender: RoleDefender, mineralMiner: RoleMineralMiner,
};
let tickCompleted = true;
function guard(label: string, task: () => void): void {
  try { task(); } catch (error) {
    tickCompleted = false;
    if (Game.time % 25 === 0) console.log(`[${label}] ${error instanceof Error ? error.stack : String(error)}`);
  }
}
export function loop(): void {
  tickCompleted = true;
  const states: RoomState[] = [];
  memory.clearDeadCreeps();
  for (const room of Object.values(Game.rooms)) {
    if (!room.controller?.my) continue;
    guard(room.name, () => {
      const state = inspectRoom(room);
      states.push(state);
      guard(`${room.name}/defense`, () => runDefense(state));

      guard(`${room.name}/spawn`, () => spawn.runRoom(state));

    });
  }
  for (const creep of Object.values(Game.creeps)) {
    if (creep.spawning) continue;
    if (!roles[creep.memory.role]) creep.memory.role = 'worker';
    guard(creep.name, () => {
      if (!retreatEconomy(creep)) roles[creep.memory.role].run(creep);
    });
  }
  // Rotate room order so optional planning is not always granted to the first room.
  const offset = states.length ? Game.time % states.length : 0;
  const scheduled = [...states.slice(offset), ...states.slice(0, offset)];
  for (const state of scheduled) {
    guard(`${state.room.name}/structures`, () => runStructures(state));
    guard(`${state.room.name}/planner`, () => optionalTask(`planner:${state.room.name}`, () => planRoom(state)));
  }
  guard('cpu', () => finishCpu(states, tickCompleted));
}
