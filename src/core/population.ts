import { settings, type Role } from '../config';
import { makeBody } from './body';
import { economicCreep, sourceContainer, threatPower, type RoomState } from './room';
export interface Request {
  role: Role;
  priority: number;
  body: BodyPartConstant[];
  sourceId?: Id<Source>;
  mineralId?: Id<Mineral>;
}
export interface PopulationPlan {
  requests: Request[];
  targets: Record<Role, number>;
}
export function planPopulation(state: RoomState): PopulationPlan {
  const { room, sources, creeps, sites } = state;
  const cfg = settings(room);
  const capacity = room.energyCapacityAvailable;
  const stored = room.storage?.store[RESOURCE_ENERGY] ?? 0;
  const level = room.controller?.level ?? 1;
  const healthy = creeps.filter(economicCreep);
  const count = (role: Role) => healthy.filter((c) => c.memory.role === role).length;
  const requests: Request[] = [];
  const targets: Record<Role, number> = {
    worker: 0,
    miner: 0,
    hauler: 0,
    upgrader: 0,
    defender: 0,
    mineralMiner: 0,
  };
  const add = (role: Role, target: number, priority: number, limit?: number) => {
    targets[role] = target;
    const body = makeBody(
      role,
      role === 'defender' ? Math.min(capacity, Math.max(200, room.energyAvailable)) : capacity,
      limit,
    );
    for (let n = count(role); n < target; n++)
      if (body.length) requests.push({ role, body, priority });
  };
  // A living worker is essential if no established mining + hauling supply chain exists.
  const hasMiner = creeps.some(
    (c) => c.memory.role === 'miner' && !c.spawning && c.getActiveBodyparts(WORK) > 0,
  );
  const hasHauler = creeps.some(
    (c) =>
      c.memory.role === 'hauler' &&
      !c.spawning &&
      c.getActiveBodyparts(CARRY) > 0 &&
      c.getActiveBodyparts(MOVE) > 0,
  );
  const feeders =
    creeps.some(
      (c) =>
        !c.spawning &&
        c.memory.role === 'worker' &&
        c.getActiveBodyparts(WORK) > 0 &&
        c.getActiveBodyparts(CARRY) > 0,
    ) ||
    (hasMiner && hasHauler);
  if (!feeders && !creeps.some((c) => c.spawning && c.memory.role === 'worker')) {
    const body = makeBody('worker', room.energyAvailable);
    if (body.length) requests.push({ role: 'worker', priority: 0, body });
  }
  let readySources = 0;
  let carryDemand = 0;
  for (const source of sources) {
    const container = sourceContainer(state, source);
    if (!container) continue;
    readySources++;
    const neededWork = Math.ceil(source.energyCapacity / ENERGY_REGEN_TIME / HARVEST_POWER);
    const minerBody = makeBody('miner', capacity, neededWork);
    const perMiner = minerBody.filter((p) => p === WORK).length;
    const terrain = room.getTerrain();
    let slots = 0;
    for (let dx = -1; dx <= 1; dx++)
      for (let dy = -1; dy <= 1; dy++) {
        const x = source.pos.x + dx,
          y = source.pos.y + dy;
        if (
          (dx || dy) &&
          x > 0 &&
          x < 49 &&
          y > 0 &&
          y < 49 &&
          terrain.get(x, y) !== TERRAIN_MASK_WALL &&
          !state.structures.some(
            (s) =>
              s.pos.x === x &&
              s.pos.y === y &&
              (OBSTACLE_OBJECT_TYPES as readonly string[]).includes(s.structureType),
          )
        )
          slots++;
      }
    const desired = perMiner ? Math.min(slots, Math.ceil(neededWork / perMiner)) : 0;
    const assigned = healthy.filter(
      (c) => c.memory.role === 'miner' && c.memory.sourceId === source.id,
    );
    const coveredWork = assigned.reduce(
      (n, c) => n + c.body.filter((p) => p.type === WORK && (c.spawning || p.hits > 0)).length,
      0,
    );
    const additional = perMiner
      ? Math.max(
          0,
          Math.min(slots - assigned.length, Math.ceil((neededWork - coveredWork) / perMiner)),
        )
      : 0;
    targets.miner += Math.max(desired, assigned.length + additional);
    for (let i = 0; i < additional; i++)
      requests.push({ role: 'miner', sourceId: source.id, body: minerBody, priority: 2 });
    const anchor = room.storage ?? state.spawns[0];
    const cache = (room.memory.haulPaths ??= {});
    const anchorKey = anchor?.id ?? room.name;
    const cached = cache[source.id];
    if (!cached || cached.anchor !== anchorKey || Game.time - cached.tick > 1000) {
      const path = anchor
        ? container.pos.findPathTo(anchor.pos, { ignoreCreeps: true, range: 1 })
        : [];
      cache[source.id] = {
        distance: path.length || (anchor ? container.pos.getRangeTo(anchor) : 10),
        tick: Game.time,
        anchor: anchorKey,
      };
    }
    const distance = cache[source.id].distance;
    const rate = source.energyCapacity / ENERGY_REGEN_TIME;
    carryDemand += Math.ceil((rate * (distance * 2 + 4)) / CARRY_CAPACITY);
  }
  const mature = readySources === sources.length && readySources > 0;
  const haulerBody = makeBody('hauler', capacity);
  const carryParts = Math.max(1, haulerBody.filter((p) => p === CARRY).length);
  const haulers = readySources ? Math.min(8, Math.max(1, Math.ceil(carryDemand / carryParts))) : 0;
  const existingHaulers = healthy.filter((c) => c.memory.role === 'hauler');
  const coveredCarry = existingHaulers.reduce(
    (n, c) => n + c.body.filter((p) => p.type === CARRY && (c.spawning || p.hits > 0)).length,
    0,
  );
  const additionalHaulers = readySources
    ? Math.max(
        0,
        Math.min(8 - existingHaulers.length, Math.ceil((carryDemand - coveredCarry) / carryParts)),
      )
    : 0;
  add(
    'hauler',
    Math.max(haulers, existingHaulers.length + additionalHaulers),
    hasMiner && count('hauler') === 0 ? 1 : 3,
  );
  const workerWork = Math.max(1, makeBody('worker', capacity).filter((p) => p === WORK).length);
  const remaining = sites.reduce((n, s) => n + s.progressTotal - s.progress, 0);
  const builders = Math.min(3, Math.ceil(remaining / (workerWork * BUILD_POWER * 1000)));
  const bootstrap = Math.min(8, Math.max(3, Math.ceil((sources.length * 5) / workerWork)));
  add(
    'worker',
    mature ? Math.max(1, room.storage && stored < cfg.storageReserve ? 1 : builders) : bootstrap,
    4,
  );
  const surplus = stored > cfg.upgradeSurplus;
  add(
    'upgrader',
    mature ? (level === 8 || !surplus ? 1 : Math.min(3, 1 + Math.floor(stored / 150000))) : 0,
    room.controller && room.controller.ticksToDowngrade < 5000 ? 1 : 5,
    level === 8 ? 15 : 10,
  );
  const threat = threatPower(state.hostiles);
  // Scouts do not trigger combat spawning. Armed invaders always get at least one guard.
  const defenders =
    threat > 0 ? Math.min(cfg.maxDefenders, Math.max(1, Math.ceil(threat / 120))) : 0;
  add('defender', defenders, 1);
  const mineral = room.find(FIND_MINERALS)[0];
  const extractor = state.structures.some(
    (s) => s.structureType === STRUCTURE_EXTRACTOR && s.isActive(),
  );
  const mineralContainer = mineral && state.containers.some((c) => c.pos.inRangeTo(mineral, 1));
  if (
    level >= 6 &&
    mineral &&
    mineral.mineralAmount > 0 &&
    extractor &&
    mineralContainer &&
    room.storage &&
    stored > cfg.storageReserve &&
    (room.storage.store[mineral.mineralType] ?? 0) < cfg.mineralCap &&
    room.storage.store.getFreeCapacity() > 10000 &&
    !threat
  ) {
    targets.mineralMiner = 1;
    if (!count('mineralMiner'))
      requests.push({
        role: 'mineralMiner',
        mineralId: mineral.id,
        priority: 6,
        body: makeBody('mineralMiner', capacity, 10),
      });
  }
  // Stable sort preserves the source order, providing fair assignments across multiple spawns.
  return { targets, requests: requests.sort((a, b) => a.priority - b.priority) };
}
