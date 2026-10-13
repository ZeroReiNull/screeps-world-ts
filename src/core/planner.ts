import { settings } from '../config';
import type { RoomState } from './room';
/** Incremental non-destructive planner. Existing structures/sites are always counted. */
export function planRoom(state: RoomState): void {
  const { room } = state;
  const cfg = settings(room);
  const level = room.controller?.level ?? 0;
  if (!cfg.autoBuild || !room.controller?.my || (!state.spawns.length && !room.memory.anchor))
    return;
  if (room.memory.lastPlan !== undefined && Game.time - room.memory.lastPlan < cfg.planInterval)
    return;
  room.memory.lastPlan = Game.time;
  const anchor = room.memory.anchor ?? state.spawns[0].pos;
  const origin = state.spawns[0]?.pos ?? new RoomPosition(anchor.x, anchor.y, room.name);
  room.memory.anchor = { x: anchor.x, y: anchor.y };
  const terrain = room.getTerrain();
  const minerals = room.find(FIND_MINERALS);
  const occupied = [...state.structures, ...state.sites].map((s) => ({
    x: s.pos.x,
    y: s.pos.y,
    type: s.structureType,
  }));
  const counts = new Map<BuildableStructureConstant, number>();
  for (const s of occupied)
    counts.set(
      s.type as BuildableStructureConstant,
      (counts.get(s.type as BuildableStructureConstant) ?? 0) + 1,
    );
  let placed = 0;
  const roomLimit = Math.max(0, cfg.maxRoomSites - state.sites.length);
  const globalLimit = Math.max(
    0,
    MAX_CONSTRUCTION_SITES - Object.keys(Game.constructionSites).length,
  );
  const limit = Math.min(cfg.maxNewSites, roomLimit, globalLimit);
  const inBounds = (x: number, y: number) =>
    x >= 2 && x <= 47 && y >= 2 && y <= 47 && terrain.get(x, y) !== TERRAIN_MASK_WALL;
  const reserved = (x: number, y: number) =>
    state.sources.some((s) => s.pos.x === x && s.pos.y === y) ||
    minerals.some((m) => m.pos.x === x && m.pos.y === y) ||
    (room.controller!.pos.x === x && room.controller!.pos.y === y);
  const valid = (x: number, y: number, type: BuildableStructureConstant) => {
    if (!inBounds(x, y) || (reserved(x, y) && type !== STRUCTURE_EXTRACTOR)) return false;
    const tile = occupied.filter((s) => s.x === x && s.y === y);
    if (tile.some((s) => s.type === type)) return false;
    if (type === STRUCTURE_RAMPART) return tile.every((s) => s.type !== STRUCTURE_WALL);
    return tile.every(
      (s) =>
        s.type === STRUCTURE_RAMPART || (type === STRUCTURE_CONTAINER && s.type === STRUCTURE_ROAD),
    );
  };
  const place = (x: number, y: number, type: BuildableStructureConstant): boolean => {
    const allowed = CONTROLLER_STRUCTURES[type][level];
    if (placed >= limit || (counts.get(type) ?? 0) >= allowed || !valid(x, y, type)) return false;
    const result = room.createConstructionSite(x, y, type);
    if (result === OK) {
      occupied.push({ x, y, type });
      counts.set(type, (counts.get(type) ?? 0) + 1);
      placed++;
      return true;
    }
    room.memory.planErrors = (room.memory.planErrors ?? 0) + 1;
    return false;
  };
  const near = (
    pos: RoomPosition,
    range: number,
    type: BuildableStructureConstant,
    minimumRange = 1,
  ) => {
    if (
      occupied.some(
        (s) => s.type === type && Math.max(Math.abs(s.x - pos.x), Math.abs(s.y - pos.y)) <= range,
      )
    )
      return;
    const options: { x: number; y: number }[] = [];
    for (let dx = -range; dx <= range; dx++)
      for (let dy = -range; dy <= range; dy++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) < minimumRange) continue;
        options.push({ x: pos.x + dx, y: pos.y + dy });
      }
    options.sort(
      (a, b) =>
        Math.max(Math.abs(a.x - anchor.x), Math.abs(a.y - anchor.y)) -
        Math.max(Math.abs(b.x - anchor.x), Math.abs(b.y - anchor.y)),
    );
    for (const p of options) {
      if (!valid(p.x, p.y, type)) continue;
      const path = origin.findPathTo(p.x, p.y, { ignoreCreeps: true, range: 1 });
      if (!path.length && !origin.inRangeTo(p.x, p.y, 1)) continue;
      if (place(p.x, p.y, type)) break;
    }
  };
  if (!state.spawns.length) {
    place(anchor.x, anchor.y, STRUCTURE_SPAWN);
    return;
  }
  // Containers from RCL1; prioritize energy production over decorative/late-game buildings.
  for (const source of state.sources) near(source.pos, 1, STRUCTURE_CONTAINER);
  if (level >= 2) near(room.controller.pos, 3, STRUCTURE_CONTAINER, 2);
  const pads: { x: number; y: number }[] = [];
  for (let dx = -12; dx <= 12; dx += 2)
    for (let dy = -12; dy <= 12; dy += 2) {
      const x = anchor.x + dx,
        y = anchor.y + dy;
      if (!inBounds(x, y) || (!dx && !dy) || reserved(x, y)) continue;
      if ([...state.sources, ...minerals, room.controller].some((s) => s.pos.inRangeTo(x, y, 2)))
        continue;
      // At least two open neighboring lanes keep individual structures accessible.
      let exits = 0;
      for (const [ox, oy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        if (
          inBounds(x + ox, y + oy) &&
          !occupied.some(
            (s) =>
              s.x === x + ox &&
              s.y === y + oy &&
              s.type !== STRUCTURE_ROAD &&
              s.type !== STRUCTURE_RAMPART &&
              s.type !== STRUCTURE_CONTAINER,
          )
        )
          exits++;
      }
      if (exits >= 2) pads.push({ x, y });
    }
  pads.sort(
    (a, b) =>
      Math.max(Math.abs(a.x - anchor.x), Math.abs(a.y - anchor.y)) -
      Math.max(Math.abs(b.x - anchor.x), Math.abs(b.y - anchor.y)),
  );
  const fill = (type: BuildableStructureConstant) => {
    for (const p of pads) {
      if (placed >= limit || (counts.get(type) ?? 0) >= CONTROLLER_STRUCTURES[type][level]) return;
      if (!valid(p.x, p.y, type)) continue;
      const path = origin.findPathTo(p.x, p.y, { ignoreCreeps: true, range: 1 });
      if (path.length || origin.inRangeTo(p.x, p.y, 1)) place(p.x, p.y, type);
    }
  };
  // Unlock order: towers/extra spawns/storage before the full extension set.
  fill(STRUCTURE_TOWER);
  fill(STRUCTURE_SPAWN);
  fill(STRUCTURE_STORAGE);
  if (level >= 2)
    for (const s of state.structures) {
      if (
        (
          [
            STRUCTURE_SPAWN,
            STRUCTURE_STORAGE,
            STRUCTURE_TOWER,
            STRUCTURE_TERMINAL,
          ] as StructureConstant[]
        ).includes(s.structureType)
      )
        place(s.pos.x, s.pos.y, STRUCTURE_RAMPART);
    }
  // Reserve up to two walkable firing positions around the first spawn.
  if (level >= 3 && state.towers.length) {
    let positions = occupied.filter(
      (s) =>
        s.type === STRUCTURE_RAMPART &&
        origin.inRangeTo(s.x, s.y, 2) &&
        !occupied.some(
          (other) =>
            other.x === s.x &&
            other.y === s.y &&
            (OBSTACLE_OBJECT_TYPES as readonly string[]).includes(other.type),
        ),
    ).length;
    for (const [dx, dy] of [
      [0, -1],
      [1, 0],
      [0, 1],
      [-1, 0],
    ]) {
      if (positions >= 2) break;
      const x = origin.x + dx,
        y = origin.y + dy;
      if (
        occupied.some(
          (s) =>
            s.x === x && s.y === y && (OBSTACLE_OBJECT_TYPES as readonly string[]).includes(s.type),
        )
      )
        continue;
      if (place(x, y, STRUCTURE_RAMPART)) positions++;
    }
  }
  fill(STRUCTURE_EXTENSION);
  if (level >= 5) {
    // A storage receiver first, followed by source links and the controller. Containers remain as a fallback.
    if (room.storage) near(room.storage.pos, 1, STRUCTURE_LINK);
    for (const source of state.sources) near(source.pos, 2, STRUCTURE_LINK);
    near(room.controller.pos, 3, STRUCTURE_LINK, 2);
  }
  if (level >= 6) {
    fill(STRUCTURE_TERMINAL);
    for (const mineral of minerals) {
      place(mineral.pos.x, mineral.pos.y, STRUCTURE_EXTRACTOR);
      near(mineral.pos, 1, STRUCTURE_CONTAINER);
    }
  }
  if (level >= 7) fill(STRUCTURE_FACTORY);
  if (level >= 8) {
    fill(STRUCTURE_OBSERVER);
    fill(STRUCTURE_POWER_SPAWN);
    fill(STRUCTURE_NUKER);
  }
  // Labs use a compact 4x3 footprint with an access lane through its middle.
  // The center pair is within range 2 of every output; existing labs are respected.
  if (
    level >= 6 &&
    (counts.get(STRUCTURE_LAB) ?? 0) < CONTROLLER_STRUCTURES[STRUCTURE_LAB][level]
  ) {
    for (const p of pads) {
      const cluster = [
        [0, 0],
        [1, 0],
        [-1, -1],
        [0, -1],
        [1, -1],
        [2, -1],
        [-1, 1],
        [0, 1],
        [1, 1],
        [2, 1],
      ];
      if (
        !cluster.every(
          ([dx, dy]) =>
            valid(p.x + dx, p.y + dy, STRUCTURE_LAB) ||
            occupied.some((s) => s.x === p.x + dx && s.y === p.y + dy && s.type === STRUCTURE_LAB),
        )
      )
        continue;
      for (const [dx, dy] of cluster) place(p.x + dx, p.y + dy, STRUCTURE_LAB);
      break;
    }
  }
  if (level >= 2 && placed < limit) {
    const goals = [...state.sources, room.controller, ...(level >= 6 ? minerals : [])];
    for (const goal of goals) {
      const path = origin.findPathTo(goal.pos, {
        ignoreCreeps: true,
        range: goal === room.controller ? 3 : 1,
        costCallback: (_roomName, matrix) => {
          for (const p of pads) if (valid(p.x, p.y, STRUCTURE_EXTENSION)) matrix.set(p.x, p.y, 255);
          return matrix;
        },
      });
      for (const step of path) {
        if (placed >= limit) break;
        place(step.x, step.y, STRUCTURE_ROAD);
      }
    }
  }
}
