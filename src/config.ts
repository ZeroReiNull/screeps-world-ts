export const ROLE_WORKER = 'worker';
export const ROLE_MINER = 'miner';

export interface RoleConfig {
    targetCount: (room: Room) => number;
}

export const ROOM_CONFIG: Record<string, RoleConfig> = {
    [ROLE_MINER]: {
        // Exactly 1 miner per energy source once containers are built
        targetCount: (room: Room) => {
            const hasContainers = room.find(FIND_STRUCTURES, {
                filter: (s) => s.structureType === STRUCTURE_CONTAINER
            }).length > 0;
            return hasContainers ? room.find(FIND_SOURCES).length : 0;
        }
    },
    [ROLE_WORKER]: {
        // RCL 1-2: 6 workers. High RCL with Storage: 3-4 heavy workers suffice
        targetCount: (room: Room) => {
            const level = room.controller ? room.controller.level : 1;
            if (level <= 2) return 6;
            if (level <= 4) return 5;
            return 3;
        }
    }
};