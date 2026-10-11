export class RoleMiner {
    public static run(creep: Creep): void {
        // Auto-bind to a unique source without an active assigned miner
        if (!creep.memory.sourceId) {
            const sources = creep.room.find(FIND_SOURCES);
            const miners = _.filter(Game.creeps, (c) => c.memory.role === 'miner');
            const targetSource = sources.find((s) => !miners.some((m) => m.memory.sourceId === s.id));
            if (targetSource) {
                creep.memory.sourceId = targetSource.id;
            } else {
                creep.memory.sourceId = sources[0].id;
            }
        }

        const source = Game.getObjectById(creep.memory.sourceId as Id<Source>);
        if (!source) return;

        // Find the adjacent container next to the assigned source
        const container = source.pos.findInRange(FIND_STRUCTURES, 1, {
            filter: (s) => s.structureType === STRUCTURE_CONTAINER
        })[0] as StructureContainer | undefined;

        // Stand directly on the container tile to deposit via drops
        if (container) {
            if (!creep.pos.isEqualTo(container.pos)) {
                creep.moveTo(container, { visualizePathStyle: { stroke: '#ff8800' } });
                return;
            }
        } else if (creep.harvest(source) === ERR_NOT_IN_RANGE) {
            creep.moveTo(source, { visualizePathStyle: { stroke: '#ff8800' } });
            return;
        }

        // Static harvest loop
        creep.harvest(source);
    }
}