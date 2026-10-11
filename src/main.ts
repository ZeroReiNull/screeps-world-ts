import { MemoryManager } from "./core/MemoryManager";
import { SpawnManager } from "./managers/SpawnManager";
import { RoleHarvester } from "./roles/Harvester";

// Global loop export required by Screeps
export const loop = function () {
    // 1. Core system execution (Garbage Collection)
    MemoryManager.clearDeadCreeps();

    // 2. Room-level scheduling (Building planning, spawn queue)
    for (const roomName in Game.rooms) {
        const room = Game.rooms[roomName];
        SpawnManager.run(room);
    }

    // 3. Entity-level scheduling (Dispatching Creep actions)
    for (const name in Game.creeps) {
        const creep = Game.creeps[name];
        
        switch (creep.memory.role) {
            case 'harvester':
                RoleHarvester.run(creep);
                break;
            // You can add more cases later: case 'upgrader': RoleUpgrader.run(creep);
            // And case 'builder', etc...
        }
    }
};