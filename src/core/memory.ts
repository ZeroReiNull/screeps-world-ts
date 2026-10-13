export class memory {
  static clearDeadCreeps(): void {
    Memory.creeps ??= {};
    Memory.rooms ??= {};
    const pending = new Set(
      Object.values(Game.spawns).flatMap((s) => (s.spawning ? [s.spawning.name] : [])),
    );
    for (const name of Object.keys(Memory.creeps)) {
      if (!Game.creeps[name] && !pending.has(name)) delete Memory.creeps[name];
    }
  }
}
