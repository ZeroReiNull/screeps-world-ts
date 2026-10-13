import { settings, type Role } from '../config';
import { makeBody } from './body';
import { economicCreep, sourceContainer, threatPower, type RoomState } from './room';
export interface Request { role: Role; priority: number; body: BodyPartConstant[]; sourceId?: Id<Source>; mineralId?: Id<Mineral> }
export interface PopulationPlan { requests: Request[]; targets: Record<Role, number> }
export function planPopulation(state: RoomState): PopulationPlan {
  const { room, sources, creeps, sites } = state;
  const cfg = settings(room);
  const capacity = room.energyCapacityAvailable;
  const stored = room.storage?.store[RESOURCE_ENERGY] ?? 0;
  const level = room.controller?.level ?? 1;
  const healthy = creeps.filter(economicCreep);
  const count = (role: Role) => healthy.filter(c => c.memory.role === role).length;
  const requests: Request[] = [];
  const targets: Record<Role, number> = { worker: 0, miner: 0, hauler: 0, upgrader: 0, defender: 0, mineralMiner: 0 };
  const add = (role: Role, target: number, priority: number, limit?: number) => {
    targets[role] = target;
    const body = makeBody(role, role === 'defender' ? Math.min(capacity, Math.max(200, room.energyAvailable)) : capacity, limit);
    for (let n = count(role); n < target; n++) if (body.length) requests.push({ role, body, priority });
  };
  // A living worker is essential if no established mining + hauling supply chain exists.
  const hasMiner = creeps.some(c => c.memory.role === 'miner' && !c.spawning && c.getActiveBodyparts(WORK) > 0);
  const hasHauler = creeps.some(c => c.memory.role === 'hauler' && !c.spawning && c.getActiveBodyparts(CARRY) > 0 && c.getActiveBodyparts(MOVE) > 0);
  const feeders = creeps.some(c => !c.spawning && c.memory.role === 'worker' && c.getActiveBodyparts(WORK) > 0 && c.getActiveBodyparts(CARRY) > 0) || (hasMiner && hasHauler);
  if (!feeders && !creeps.some(c => c.spawning && c.memory.role === 'worker')) {
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
    const perMiner = minerBody.filter(p => p === WORK).length;
    const terrain = room.getTerrain();
    let slots = 0;
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
      const x = source.pos.x + dx, y = source.pos.y + dy;
      if ((dx || dy) && x > 0 && x < 49 && y > 0 && y < 49 && terrain.get(x, y) !== TERRAIN_MASK_WALL
        && !state.structures.some(s => s.pos.x === x && s.pos.y === y && (OBSTACLE_OBJECT_TYPES as readonly string[]).includes(s.structureType))) slots++;
    }
    const desired = perMiner ? Math.min(slots, Math.ceil(neededWork / perMiner)) : 0;
    const assigned = healthy.filter(c => c.memory.role === 'miner' && c.memory.sourceId === source.id);
    const coveredWork = assigned.reduce((n, c) => n + c.body.filter(p => p.type === WORK && (c.spawning || p.hits > 0)).length, 0);
    const additional = perMiner ? Math.max(0, Math.min(slots - assigned.length, Math.ceil((neededWork - coveredWork) / perMiner))) : 0;
    targets.miner += Math.max(desired, assigned.length + additional);
    let missingWork = Math.max(0, neededWork - coveredWork);
    for (let i = 0; i < additional; i++) {
      const body = makeBody('miner', capacity, missingWork);
      requests.push({ role: 'miner', sourceId: source.id, body, priority: 2 });
      missingWork -= body.filter(part => part === WORK).length;
    }
    const anchor = room.storage ?? state.spawns[0];
    const cache = room.memory.haulPaths ??= {};
    const anchorKey = anchor?.id ?? room.name;
    const cached = cache[source.id];
    if (!cached || cached.anchor !== anchorKey || Game.time - cached.tick > 1000) {
      const path = anchor ? container.pos.findPathTo(anchor.pos, { ignoreCreeps: true, range: 1 }) : [];
      cache[source.id] = { distance: path.length || (anchor ? container.pos.getRangeTo(anchor) : 10), tick: Game.time, anchor: anchorKey };
    }
    const distance = cache[source.id].distance;
    const rate = source.energyCapacity / ENERGY_REGEN_TIME;
    carryDemand += Math.ceil(rate * (distance * 2 + 4) / CARRY_CAPACITY);
  }
  const mature = readySources === sources.length && readySources > 0;
  const workerWork = Math.max(1, makeBody('worker', capacity).filter(p => p === WORK).length);
  const remaining = sites.reduce((n, s) => n + s.progressTotal - s.progress, 0);
  const builders = Math.min(3, Math.ceil(remaining / (workerWork * BUILD_POWER * 1000)));
  const bootstrap = Math.min(8, Math.max(3, Math.ceil(sources.length * 5 / workerWork)));
  add('worker', mature ? Math.max(1, (room.storage && stored < cfg.storageReserve) ? 1 : builders) : bootstrap, 4);
  // Require sustained surplus and use separate entry/exit thresholds to avoid oscillation.
  const overflow = room.memory.energyOverflow ??= { active: false };
  const sourceStores = [...new Set(sources.map(s => sourceContainer(state, s)).filter(
    (c): c is StructureContainer => !!c,
  ))];
  const sourceEnergy = sourceStores.reduce((sum, c) => sum + c.store[RESOURCE_ENERGY], 0);
  const droppedEnergy = room.find(FIND_DROPPED_RESOURCES).filter(r =>
    r.resourceType === RESOURCE_ENERGY && sources.some(s => s.pos.inRangeTo(r, 2)),
  ).reduce((sum, r) => sum + r.amount, 0);
  const backlog = sourceEnergy + droppedEnergy;
  const threatened = threatPower(state.hostiles) > 0;
  const eligible = mature && !room.storage && level < 8 && !threatened;
  if (!eligible || backlog < sources.length * 400) {
    overflow.active = false;
    delete overflow.since;
  } else if (!overflow.active) {
    if (backlog >= sources.length * 1200 && room.energyAvailable >= capacity * 0.8) {
      overflow.since ??= Game.time;
      if (Game.time - overflow.since >= 100) overflow.active = true;
    } else delete overflow.since;
  }
  const surplus = stored > cfg.upgradeSurplus;
  const upgradeWork = Math.max(1, makeBody('upgrader', capacity).filter(p => p === WORK).length);
  const income = sources.reduce((sum, s) => sum + s.energyCapacity / ENERGY_REGEN_TIME, 0);
  const overflowUpgraders = Math.max(1, Math.min(5, Math.floor(income * 0.6 / upgradeWork)));
  const upgradeTarget = overflow.active ? overflowUpgraders
    : (level === 8 || !surplus ? 1 : Math.min(3, 1 + Math.floor(stored / 150000)));
  // Budget the controller delivery leg as well as source collection.
  const controllerSupply = state.containers.find(c => room.controller?.pos.inRangeTo(c, 3));
  const controllerLink = state.structures.some(s => s.structureType === STRUCTURE_LINK
    && room.controller?.pos.inRangeTo(s, 3) && 'isActive' in s && s.isActive());
  const haulAnchor = room.storage ?? state.spawns[0];
  if (mature && controllerSupply && haulAnchor && !controllerLink) {
    const cache = room.memory.haulPaths ??= {};
    const key = `controller:${controllerSupply.id}`;
    let route = cache[key];
    if (!route || route.anchor !== haulAnchor.id || Game.time - route.tick > 1000) {
      const path = haulAnchor.pos.findPathTo(controllerSupply.pos, { ignoreCreeps: true, range: 1 });
      route = cache[key] = { distance: path.length || haulAnchor.pos.getRangeTo(controllerSupply), tick: Game.time, anchor: haulAnchor.id };
    }
    const existingWork = healthy.filter(c => c.memory.role === 'upgrader').reduce((sum, c) =>
      sum + c.getActiveBodyparts(WORK), 0);
    const upgradeRate = Math.min(income, Math.max(existingWork, upgradeTarget * upgradeWork));
    carryDemand += Math.ceil(upgradeRate * (route.distance * 2 + 2) / CARRY_CAPACITY);
  }
  const haulerBody = makeBody('hauler', capacity);
  const carryParts = Math.max(1, haulerBody.filter(p => p === CARRY).length);
  const haulers = readySources ? Math.min(8, Math.max(1, Math.ceil(carryDemand / carryParts))) : 0;
  const existingHaulers = healthy.filter(c => c.memory.role === 'hauler');
  const coveredCarry = existingHaulers.reduce((n, c) => n + c.body.filter(p => p.type === CARRY && (c.spawning || p.hits > 0)).length, 0);
  const additionalHaulers = readySources ? Math.max(0, Math.min(8 - existingHaulers.length, Math.ceil((carryDemand - coveredCarry) / carryParts))) : 0;
  add('hauler', Math.max(haulers, existingHaulers.length + additionalHaulers), hasMiner && count('hauler') === 0 ? 1 : 3);
  add('upgrader', mature ? upgradeTarget : 0,
    room.controller && room.controller.ticksToDowngrade < 5000 ? 1 : 5, level === 8 ? 15 : 10);
  const threat = threatPower(state.hostiles);
  // Scouts do not trigger combat spawning. Armed invaders always get at least one guard.
  // Keep one guard briefly after an attack once towers and a viable body are available.
  const recentThreat = room.memory.lastThreat !== undefined && Game.time - room.memory.lastThreat < 1500;
  const standby = level >= 3 && capacity >= 800 && state.towers.length > 0 && recentThreat ? 1 : 0;
  const defenders = room.controller?.safeMode ? 0 : threat > 0
    ? Math.min(cfg.maxDefenders, level < 3 ? 1 : Math.max(1, Math.ceil(threat / 120)))
    : Math.min(cfg.maxDefenders, standby);
  add('defender', defenders, threat > 0 ? 1 : 6);
  const mineral = room.find(FIND_MINERALS)[0];
  const extractor = state.structures.some(s => s.structureType === STRUCTURE_EXTRACTOR && s.isActive());
  const mineralContainer = mineral && state.containers.some(c => c.pos.inRangeTo(mineral, 1));
  if (level >= 6 && mineral && mineral.mineralAmount > 0 && extractor && mineralContainer && room.storage
    && stored > cfg.storageReserve && (room.storage.store[mineral.mineralType] ?? 0) < cfg.mineralCap
    && room.storage.store.getFreeCapacity() > 10000 && !threat) {
    targets.mineralMiner = 1;
    if (!count('mineralMiner')) requests.push({ role: 'mineralMiner', mineralId: mineral.id, priority: 6,
      body: makeBody('mineralMiner', capacity, 10) });
  }
  // Stable sort preserves the source order, providing fair assignments across multiple spawns.
  return { targets, requests: requests.sort((a, b) => a.priority - b.priority) };
}
