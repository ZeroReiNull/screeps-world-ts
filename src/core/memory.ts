export class memory {
    /**
     * Clear memory of dead creeps to prevent memory leaks
     */
    public static clearDeadCreeps(): void {
        for (const name in Memory.creeps) {
            if (!(name in Game.creeps)) {
                delete Memory.creeps[name];
                console.log(`[Memory] 🗑️ Cleared memory for dead creep: ${name}`);
            }
        }
    }
}