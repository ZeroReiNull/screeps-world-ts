export class SpawnManager {
    public static run(room: Room): void {
        const spawns = room.find(FIND_MY_SPAWNS);
        if (spawns.length === 0) return;

        const spawn = spawns[0];
        
        // Skip if currently spawning to save CPU
        if (spawn.spawning) return;

        // Count the number of harvesters in the current room
        const harvesters = _.filter(Game.creeps, (creep) => creep.memory.role == 'harvester' && creep.room.name === room.name);

        // Simple quantity maintenance logic: keep at least 3 harvesters
        if (harvesters.length < 3) {
            const newName = 'Harvester_' + Game.time;
            const status = spawn.spawnCreep([WORK, CARRY, MOVE], newName, {
                memory: { role: 'harvester', room: room.name, working: false }
            });

            if (status === OK) {
                console.log(`[Spawn] 🥚 Room ${room.name} is spawning new Harvester: ${newName}`);
            }
        }
    }
}