import type { RoomState } from './room';
/** Non-market structure operations. Expensive industry is opt-in per room. */
export function runStructures(state: RoomState): void {
  const { room } = state;
  const links = state.structures.filter((s): s is StructureLink => s.structureType === STRUCTURE_LINK && s.my && s.isActive());
  const sourceLinks = links.filter(l => state.sources.some(s => s.pos.inRangeTo(l, 2)));
  const receivers = links.filter(l => !sourceLinks.includes(l)).sort((a, b) =>
    (room.controller?.pos.getRangeTo(a) ?? 50) - (room.controller?.pos.getRangeTo(b) ?? 50));
  const free = new Map(receivers.map(l => [l.id, l.store.getFreeCapacity(RESOURCE_ENERGY)]));
  for (const link of sourceLinks) {
    if (link.cooldown || link.store[RESOURCE_ENERGY] < 100) continue;
    const target = receivers.find(l => (free.get(l.id) ?? 0) >= 100);
    if (target) {
      const amount = Math.min(link.store[RESOURCE_ENERGY], free.get(target.id)!);
      if (link.transferEnergy(target, amount) === OK) free.set(target.id, free.get(target.id)! - amount);
    }
  }
  if (room.memory.labReaction) {
    const [a, b] = room.memory.labReaction.inputs.map(id => Game.getObjectById(id));
    if (a?.my && b?.my && a.mineralType && b.mineralType) {
      const product = (REACTIONS as Record<string, Record<string, string>>)[a.mineralType]?.[b.mineralType];
      if (product) for (const id of room.memory.labReaction.outputs) {
        const lab = Game.getObjectById(id);
        if (lab?.my && lab.id !== a.id && lab.id !== b.id && !lab.cooldown
          && lab.pos.inRangeTo(a, 2) && lab.pos.inRangeTo(b, 2)
          && (!lab.mineralType || lab.mineralType === product)) lab.runReaction(a, b);
      }
    }
  }
  const factory = state.structures.find((s): s is StructureFactory => s.structureType === STRUCTURE_FACTORY && s.my && s.isActive());
  const product = room.memory.factoryProduct;
  if (factory && product && COMMODITIES[product] && !factory.cooldown) {
    const recipe = COMMODITIES[product];
    if ((!recipe.level || factory.level === recipe.level)
      && Object.entries(recipe.components).every(([r, amount]) => factory.store[r as ResourceConstant] >= amount!)) factory.produce(product);
  }
  const powerSpawn = state.structures.find((s): s is StructurePowerSpawn => s.structureType === STRUCTURE_POWER_SPAWN && s.my && s.isActive());
  if (room.memory.processPower && powerSpawn && powerSpawn.store[RESOURCE_POWER] >= 1
    && powerSpawn.store[RESOURCE_ENERGY] >= POWER_SPAWN_ENERGY_RATIO) powerSpawn.processPower();
  const observer = state.structures.find((s): s is StructureObserver => s.structureType === STRUCTURE_OBSERVER && s.my && s.isActive());
  if (observer) {
    const neighbors = Object.values(Game.map.describeExits(room.name) ?? {});
    if (neighbors.length) observer.observeRoom(neighbors[Game.time % neighbors.length]!);
  }
}
