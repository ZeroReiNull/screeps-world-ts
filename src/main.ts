import { memory } from './core/memory';
import { spawn } from './core/spawn';
import { RoleWorker } from './roles/RoleWorker';
import { RoleMiner } from './roles/RoleMiner';
import { ROLE_WORKER, ROLE_MINER } from './config';

export function loop(): void {
    // 1. Maintain memory hygiene
    memory.clearDeadCreeps();

    // 2. Drive spawning operations across all visible rooms
    for (const spawnName in Game.spawns) {
        spawn.run(Game.spawns[spawnName]);
    }

    // 3. Execute creep behavioral logic
    for (const name in Game.creeps) {
        const creep = Game.creeps[name];
        if (creep.spawning) continue;

        switch (creep.memory.role) {
            case ROLE_WORKER:
                RoleWorker.run(creep);
                break;
            case ROLE_MINER:
                RoleMiner.run(creep);
                break;
            default:
                break;
        }
    }

    // 4. Generate a Pixel if possible
    if (typeof Game.cpu.generatePixel === 'function' && Game.cpu.bucket >= 10000) {
        const res = Game.cpu.generatePixel();
        if (res === OK) {
            console.log(`Successfully minted 1 Pixel at tick ${Game.time}!`);
        }
    }
}