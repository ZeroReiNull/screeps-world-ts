export class RoleWorker {
    public static run(creep: Creep): void {
        // 1. State machine transition
        if (creep.memory.working && creep.store[RESOURCE_ENERGY] === 0) {
            creep.memory.working = false;
            creep.say('🔄 load');
        } else if (!creep.memory.working && creep.store.getFreeCapacity() === 0) {
            creep.memory.working = true;
            creep.say('⚡ work');
        }

        // 2. Working state
        if (creep.memory.working) {
            // Priority S: Emergency Downgrade Prevention
            // Immediately override all other tasks if Controller is at risk (< 3000 ticks)
            const controller = creep.room.controller;
            if (controller && controller.my && controller.level > 1 && controller.ticksToDowngrade < 1000) {
                creep.say('🚨 save RC');
                if (creep.upgradeController(controller) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(controller, { visualizePathStyle: { stroke: '#ff0000' } });
                }
                return;
            }

            // Priority A: Fill Spawn, Extensions, and Towers (< 80% capacity)
            const urgentTarget = creep.pos.findClosestByPath(FIND_MY_STRUCTURES, {
                filter: (s) => {
                    const needsEnergy = (s.structureType === STRUCTURE_SPAWN ||
                                         s.structureType === STRUCTURE_EXTENSION ||
                                         (s.structureType === STRUCTURE_TOWER && s.store.getFreeCapacity(RESOURCE_ENERGY) > 200));
                    return needsEnergy && s.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
                }
            });

            if (urgentTarget) {
                if (creep.transfer(urgentTarget, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(urgentTarget, { visualizePathStyle: { stroke: '#ffffff' } });
                }
                return;
            }

            // Priority B: Automatic Repair (Safe thresholds to avoid energy drains)
            const repairTarget = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                filter: (s) => {
                    if (s.structureType === STRUCTURE_ROAD || s.structureType === STRUCTURE_CONTAINER) {
                        return s.hits < s.hitsMax * 0.6;
                    }
                    if (s.structureType === STRUCTURE_WALL || s.structureType === STRUCTURE_RAMPART) {
                        const rcl = creep.room.controller ? creep.room.controller.level : 1;
                        return s.hits < rcl * 10000;
                    }
                    return s.hits < s.hitsMax * 0.8;
                }
            });

            if (repairTarget) {
                if (creep.repair(repairTarget) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(repairTarget, { visualizePathStyle: { stroke: '#ffaa00' } });
                }
                return;
            }

            // Priority C: Build construction sites
            const site = creep.pos.findClosestByPath(FIND_MY_CONSTRUCTION_SITES);
            if (site) {
                if (creep.build(site) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(site, { visualizePathStyle: { stroke: '#11ff11' } });
                }
                return;
            }

            // Priority D: Fallback - Upgrade controller
            if (creep.room.controller) {
                if (creep.upgradeController(creep.room.controller) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(creep.room.controller, { visualizePathStyle: { stroke: '#00ffff' } });
                }
            }
        } 
        // 3. Gathering state (Auto degradation: Storage -> Ruins/Drops -> Containers -> Sources)
        else {
            const storage = creep.room.storage;
            if (storage && storage.store[RESOURCE_ENERGY] > 1000) {
                if (creep.withdraw(storage, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(storage, { visualizePathStyle: { stroke: '#ffaa00' } });
                }
                return;
            }

            const dropped = creep.pos.findClosestByPath(FIND_DROPPED_RESOURCES, {
                filter: (r) => r.resourceType === RESOURCE_ENERGY && r.amount > 50
            });
            if (dropped) {
                if (creep.pickup(dropped) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(dropped, { visualizePathStyle: { stroke: '#ffaa00' } });
                }
                return;
            }

            const container = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                filter: (s) => s.structureType === STRUCTURE_CONTAINER && s.store[RESOURCE_ENERGY] > 100
            });
            if (container) {
                if (creep.withdraw(container, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(container, { visualizePathStyle: { stroke: '#ffaa00' } });
                }
                return;
            }

            // Auto-balance dual sources
            if (!creep.memory.sourceId) {
                const sources = creep.room.find(FIND_SOURCES);
                creep.memory.sourceId = _.min(sources, (s) => 
                    _.filter(Game.creeps, (c) => c.memory.sourceId === s.id).length
                ).id;
            }

            const source = Game.getObjectById(creep.memory.sourceId as Id<Source>);
            if (source && creep.harvest(source) === ERR_NOT_IN_RANGE) {
                creep.moveTo(source, { visualizePathStyle: { stroke: '#ffaa00' } });
            }
        }
    }
}