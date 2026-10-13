import { vi } from 'vitest';
import type { Role } from '../src/config';
export const objects = new Map<string, unknown>();
// Mocks model API selection and action intents, not the complete Screeps engine.
export class Position {
  constructor(
    public x: number,
    public y: number,
    public roomName = 'W1N1',
  ) {}
  getRangeTo(
    target: { pos?: { x: number; y: number }; x?: number; y?: number } | number,
    y?: number,
  ): number {
    const p = typeof target === 'number' ? { x: target, y: y! } : (target.pos ?? target);
    return Math.max(Math.abs(this.x - p.x!), Math.abs(this.y - p.y!));
  }
  inRangeTo(target: object | number, rangeOrY: number, range?: number): boolean {
    return typeof target === 'number'
      ? this.getRangeTo(target, rangeOrY) <= range!
      : this.getRangeTo(target) <= rangeOrY;
  }
  isEqualTo(target: { pos?: { x: number; y: number }; x?: number; y?: number }): boolean {
    return this.getRangeTo(target) === 0;
  }
  getDirectionTo(): number {
    return 3;
  }
  findClosestByPath<T extends { pos: RoomPosition }>(
    input: T[] | number,
    opts?: { filter?: (value: T) => boolean },
  ): T | null {
    const room = Game.rooms[this.roomName];
    let values: T[] = Array.isArray(input)
      ? input
      : (room.find(input as FindConstant) as unknown as T[]);
    if (opts?.filter) values = values.filter(opts.filter);
    return [...values].sort((a, b) => this.getRangeTo(a) - this.getRangeTo(b))[0] ?? null;
  }
  findClosestByRange<T extends { pos: RoomPosition }>(
    input: T[] | number,
    opts?: { filter?: (value: T) => boolean },
  ): T | null {
    return this.findClosestByPath(input, opts);
  }
  findInRange<T extends { pos: RoomPosition }>(
    input: T[] | number,
    range: number,
    opts?: { filter?: (value: T) => boolean },
  ): T[] {
    let values: T[] = Array.isArray(input)
      ? input
      : (Game.rooms[this.roomName].find(input as FindConstant) as unknown as T[]);
    if (opts?.filter) values = values.filter(opts.filter);
    return values.filter((v) => this.inRangeTo(v, range));
  }
  lookFor(type: string): unknown[] {
    const room = Game.rooms[this.roomName];
    const values = type === 'structure' ? room.find(FIND_STRUCTURES) : room.find(FIND_MY_CREEPS);
    return values.filter((v) => this.isEqualTo(v.pos));
  }
  findPathTo(
    target: RoomPosition | number,
    yOrOptions?: number | object,
    options?: { range?: number },
  ): PathStep[] {
    const p = typeof target === 'number' ? { x: target, y: yOrOptions as number } : target;
    const range =
      (typeof yOrOptions === 'object'
        ? (yOrOptions as { range?: number }).range
        : options?.range) ?? 0;
    const path: PathStep[] = [];
    let x = this.x,
      y = this.y;
    while (Math.max(Math.abs(x - p.x), Math.abs(y - p.y)) > range && path.length < 50) {
      const dx = Math.sign(p.x - x),
        dy = Math.sign(p.y - y);
      x += dx;
      y += dy;
      path.push({ x, y, dx, dy, direction: 3 });
    }
    return path;
  }
}
export function pos(x: number, y: number, roomName = 'W1N1'): RoomPosition {
  return new Position(x, y, roomName) as unknown as RoomPosition;
}
export function store<T extends StoreDefinition = StoreDefinition>(
  values: Record<string, number> = {},
  capacity = 1000,
): T {
  const result = { ...values };
  if (!('energy' in result)) result.energy = 0;
  Object.defineProperties(result, {
    getUsedCapacity: {
      value: (resource?: string) =>
        resource ? (result[resource] ?? 0) : Object.values(result).reduce((a, b) => a + b, 0),
    },
    getCapacity: { value: () => capacity },
    getFreeCapacity: { value: () => capacity - Object.values(result).reduce((a, b) => a + b, 0) },
  });
  return result as unknown as T;
}
export interface Fixture {
  room: Room;
  structures: AnyStructure[];
  sites: ConstructionSite[];
  sources: Source[];
  hostiles: Creep[];
  minerals: Mineral[];
  drops: Resource[];
  tombstones: Tombstone[];
  ruins: Ruin[];
}
let serial = 0;
export function fixture(level = 1, capacity = 300, name = 'W1N1'): Fixture {
  const f = {
    structures: [],
    sites: [],
    sources: [],
    hostiles: [],
    minerals: [],
    drops: [],
    tombstones: [],
    ruins: [],
  } as unknown as Fixture;
  const memory = (Memory.rooms[name] ??= {});
  const controller = {
    my: true,
    level,
    pos: pos(40, 40, name),
    ticksToDowngrade: 20000,
    safeModeAvailable: 1,
    activateSafeMode: vi.fn(() => OK),
  } as unknown as StructureController;
  const room = {
    name,
    memory,
    controller,
    energyAvailable: capacity,
    energyCapacityAvailable: capacity,
    getTerrain: vi.fn(() => ({ get: () => 0 })),
    find: vi.fn((type: number, opts?: { filter?: (v: unknown) => boolean }) => {
      const table: Record<number, unknown[]> = {
        [FIND_SOURCES]: f.sources,
        [FIND_STRUCTURES]: f.structures,
        [FIND_MY_STRUCTURES]: f.structures.filter((s) => 'my' in s && s.my),
        [FIND_MY_CREEPS]: Object.values(Game.creeps).filter((c) => c.room.name === name),
        [FIND_HOSTILE_CREEPS]: f.hostiles,
        [FIND_MY_CONSTRUCTION_SITES]: f.sites,
        [FIND_MINERALS]: f.minerals,
        [FIND_DROPPED_RESOURCES]: f.drops,
        [FIND_TOMBSTONES]: f.tombstones,
        [FIND_RUINS]: f.ruins,
      };
      const values = table[type] ?? [];
      return opts?.filter ? values.filter(opts.filter) : values;
    }),
    createConstructionSite: vi.fn((x: number, y: number, type: BuildableStructureConstant) => {
      const id = `site_${serial++}`;
      const site = {
        id,
        pos: pos(x, y, name),
        structureType: type,
        my: true,
        progress: 0,
        progressTotal: 5000,
      } as ConstructionSite;
      f.sites.push(site);
      Game.constructionSites[id] = site;
      return OK;
    }),
  } as unknown as Room;
  f.room = room;
  Game.rooms[name] = room;
  return f;
}
export function structure<T extends AnyStructure = AnyStructure>(
  f: Fixture,
  type: StructureConstant,
  x = 25,
  y = 25,
  energy = 0,
  capacity = 1000,
): T {
  const s = {
    id: `structure_${serial++}`,
    room: f.room,
    pos: pos(x, y, f.room.name),
    structureType: type,
    store: store({ energy }, capacity),
    hits: 10000,
    hitsMax: 10000,
    my: true,
    isActive: vi.fn(() => true),
    cooldown: 0,
    attack: vi.fn(() => OK),
    heal: vi.fn(() => OK),
    repair: vi.fn(() => OK),
    transferEnergy: vi.fn(() => OK),
    runReaction: vi.fn(() => OK),
    produce: vi.fn(() => OK),
    processPower: vi.fn(() => OK),
    observeRoom: vi.fn(() => OK),
  } as unknown as T;
  f.structures.push(s);
  objects.set(s.id, s);
  if (type === STRUCTURE_STORAGE) f.room.storage = s as StructureStorage;
  if (type === STRUCTURE_TERMINAL) f.room.terminal = s as StructureTerminal;
  return s;
}
export function spawner(f: Fixture, name = 'Spawn1', x = 25, y = 25): StructureSpawn {
  const s = structure<StructureSpawn>(f, STRUCTURE_SPAWN, x, y, 300, 300);
  s.name = name;
  s.spawnCreep = vi.fn(() => OK);
  Game.spawns[name] = s;
  return s;
}
export function source(f: Fixture, x = 10, y = 10): Source {
  const s = {
    id: `source_${serial++}`,
    room: f.room,
    pos: pos(x, y, f.room.name),
    energy: 3000,
    energyCapacity: 3000,
  } as Source;
  f.sources.push(s);
  objects.set(s.id, s);
  return s;
}
export function creep(
  f: Fixture,
  role: Role = 'worker',
  body: BodyPartConstant[] = [WORK, CARRY, MOVE],
  opts: Partial<Creep> = {},
): Creep {
  const c = {
    name: `creep_${serial++}`,
    id: `creep_id_${serial++}`,
    memory: { role, working: false, home: f.room.name },
    room: f.room,
    pos: pos(25, 25, f.room.name),
    store: store({}, 50),
    ticksToLive: 1500,
    hits: 1000,
    hitsMax: 1000,
    body: body.map((type) => ({ type, hits: 100 })),
    spawning: false,
    moveTo: vi.fn(() => OK),
    move: vi.fn(() => OK),
    harvest: vi.fn(() => OK),
    transfer: vi.fn(() => OK),
    withdraw: vi.fn(() => OK),
    pickup: vi.fn(() => OK),
    drop: vi.fn(() => OK),
    repair: vi.fn(() => OK),
    build: vi.fn(() => OK),
    upgradeController: vi.fn(() => OK),
    rangedAttack: vi.fn(() => OK),
    heal: vi.fn(() => OK),
    rangedHeal: vi.fn(() => OK),
    getActiveBodyparts: vi.fn((part: BodyPartConstant) => body.filter((p) => p === part).length),
    ...opts,
  } as unknown as Creep;
  objects.set(c.id, c);
  Game.creeps[c.name] = c;
  Memory.creeps[c.name] = c.memory;
  return c;
}
