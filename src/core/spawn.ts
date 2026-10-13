import { bodyCost, makeBody } from './body';
import { inspectRoom, type RoomState } from './room';
import { planPopulation } from './population';
export class spawn {
  static getBalancedWorkerBody(energy: number): BodyPartConstant[] {
    return makeBody('worker', energy);
  }
  static getStaticMinerBody(energy: number): BodyPartConstant[] {
    return makeBody('miner', energy, 5);
  }
  static run(spawner: StructureSpawn): void {
    this.runRoom(inspectRoom(spawner.room));
  }
  static runRoom(state: RoomState): void {
    const plan = planPopulation(state);
    const room = state.room;
    room.memory.stats = {
      tick: Game.time,
      rcl: room.controller?.level ?? 0,
      energy: room.energyAvailable,
      stored: room.storage?.store[RESOURCE_ENERGY] ?? 0,
      hostiles: state.hostiles.length,
      targets: plan.targets,
    };
    let remaining = room.energyAvailable;
    for (const spawner of state.spawns) {
      if (spawner.spawning || !spawner.isActive()) continue;
      const request = plan.requests[0];
      if (!request) break;
      const cost = bodyCost(request.body);
      // Essential recovery request uses current energy; normal requests wait for a useful body.
      if (cost > remaining) break;
      const name = `${request.role}_${spawner.name}_${Game.time}`;
      const result = spawner.spawnCreep(request.body, name, {
        memory: {
          role: request.role,
          working: false,
          home: room.name,
          ...(request.sourceId ? { sourceId: request.sourceId } : {}),
          ...(request.mineralId ? { mineralId: request.mineralId } : {}),
        },
      });
      if (result === OK) {
        remaining -= cost;
        plan.requests.shift();
      } else if (result !== ERR_BUSY && result !== ERR_NOT_ENOUGH_ENERGY) {
        if (Game.time % 25 === 0) console.log(`[spawn ${spawner.name}] ${request.role}: ${result}`);
      }
    }
  }
}
