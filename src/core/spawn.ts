import { ROLE_WORKER, ROLE_MINER } from '../config';

export class spawn {
    /**
     * Dynamically generates an optimal balanced body based on available energy capacity.
     * Capped at 1800 energy (30 parts) to prevent over-sizing and CPU waste.
     */
    public static getBalancedWorkerBody(energyCapacity: number): BodyPartConstant[] {
        const targetEnergy = Math.min(energyCapacity, 1800);
        const segmentCost = 200; // WORK(100) + CARRY(50) + MOVE(50)
        const segments = Math.max(1, Math.min(Math.floor(targetEnergy / segmentCost), 10));

        const body: BodyPartConstant[] = [];
        for (let i = 0; i < segments; i++) body.push(WORK);
        for (let i = 0; i < segments; i++) body.push(CARRY);
        for (let i = 0; i < segments; i++) body.push(MOVE);

        return body;
    }

    /**
     * Generates a static miner body (standard 5 WORK, 1 CARRY, 1-3 MOVE).
     * 5 WORK parts harvest 10 energy/tick, saturating a standard 3000-energy source.
     */
    public static getStaticMinerBody(energyCapacity: number): BodyPartConstant[] {
        if (energyCapacity >= 550) {
            return [WORK, WORK, WORK, WORK, WORK, CARRY, MOVE]; // 550 energy
        }
        // Fallback for lower capacity
        const workParts = Math.min(5, Math.floor((energyCapacity - 100) / 100));
        const body: BodyPartConstant[] = [];
        for (let i = 0; i < Math.max(1, workParts); i++) body.push(WORK);
        body.push(CARRY);
        body.push(MOVE);
        return body;
    }

    /**
     * Autonomous spawn manager with emergency crash-recovery.
     */
    public static run(spawn: StructureSpawn): void {
        if (spawn.spawning) return;

        const room = spawn.room;
        const creeps = room.find(FIND_MY_CREEPS);

        // Emergency Recovery: If 0 creeps are alive, spawn a 200-energy emergency worker immediately
        if (creeps.length === 0) {
            if (room.energyAvailable >= 200) {
                spawn.spawnCreep([WORK, CARRY, MOVE], `Worker_Recovery_${Game.time}`, {
                    memory: { role: ROLE_WORKER, working: false }
                });
            }
            return;
        }

        // Wait until room energy capacity is fully satisfied before building high-tier creeps
        if (room.energyAvailable < room.energyCapacityAvailable) return;

        // Check Miner requirements
        const miners = creeps.filter((c) => c.memory.role === ROLE_MINER);
        const containers = room.find(FIND_STRUCTURES, {
            filter: (s) => s.structureType === STRUCTURE_CONTAINER
        });
        const sources = room.find(FIND_SOURCES);

        if (containers.length > 0 && miners.length < sources.length) {
            const body = this.getStaticMinerBody(room.energyCapacityAvailable);
            spawn.spawnCreep(body, `Miner_${Game.time}`, {
                memory: { role: ROLE_MINER, working: false }
            });
            return;
        }

        // Check Worker requirements
        const workers = creeps.filter((c) => c.memory.role === ROLE_WORKER);
        const targetWorkers = (room.controller && room.controller.level <= 2) ? 6 : 4;

        if (workers.length < targetWorkers) {
            const body = this.getBalancedWorkerBody(room.energyCapacityAvailable);
            spawn.spawnCreep(body, `Worker_${Game.time}`, {
                memory: { role: ROLE_WORKER, working: false }
            });
        }
    }
}