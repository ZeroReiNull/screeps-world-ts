import { describe, it, expect, vi } from 'vitest';
import { fixture, source, structure, spawner, pos, objects } from './mock';
import { inspectRoom } from '../src/core/room';
import { planRoom } from '../src/core/planner';
describe('room construction', () => {
  it.each([1, 2, 3, 4, 5, 6, 7, 8])('only places legal unlocked sites at RCL %i', (level) => {
    const f = fixture(level);
    spawner(f);
    source(f);
    source(f, 15, 12);
    planRoom(inspectRoom(f.room));
    expect(f.sites.length).toBeLessThanOrEqual(4);
    for (const s of f.sites)
      expect(CONTROLLER_STRUCTURES[s.structureType][level]).toBeGreaterThan(0);
  });
  it('respects walls, room boundaries and per-room/global site limits', () => {
    const f = fixture(8);
    spawner(f, 'Spawn1', 3, 3);
    source(f, 10, 10);
    vi.mocked(f.room.getTerrain).mockReturnValue({
      get: (x, y) => (x === 4 || y === 4 ? TERRAIN_MASK_WALL : 0),
    } as RoomTerrain);
    planRoom(inspectRoom(f.room));
    for (const s of f.sites) {
      expect(s.pos.x).toBeGreaterThanOrEqual(2);
      expect(s.pos.y).toBeGreaterThanOrEqual(2);
      expect(s.pos.x).not.toBe(4);
      expect(s.pos.y).not.toBe(4);
    }
    f.room.memory.lastPlan = undefined;
    f.room.memory.settings = { maxRoomSites: f.sites.length };
    vi.mocked(f.room.createConstructionSite).mockClear();
    planRoom(inspectRoom(f.room));
    expect(f.room.createConstructionSite).not.toHaveBeenCalled();
  });
  it('respects global construction cap and disable switch', () => {
    const f = fixture(8);
    spawner(f);
    source(f);
    for (let i = 0; i < 100; i++) Game.constructionSites[`other_${i}`] = {} as ConstructionSite;
    planRoom(inspectRoom(f.room));
    expect(f.room.createConstructionSite).not.toHaveBeenCalled();
    Game.constructionSites = {};
    f.room.memory.settings = { autoBuild: false };
    f.room.memory.lastPlan = undefined;
    planRoom(inspectRoom(f.room));
    expect(f.room.createConstructionSite).not.toHaveBeenCalled();
  });
  it('counts existing structures and pending sites without duplicating them', () => {
    const f = fixture(2);
    spawner(f);
    source(f);
    structure(f, STRUCTURE_CONTAINER, 11, 10);
    f.room.createConstructionSite(39, 39, STRUCTURE_CONTAINER);
    vi.mocked(f.room.createConstructionSite).mockClear();
    planRoom(inspectRoom(f.room));
    expect(
      vi
        .mocked(f.room.createConstructionSite)
        .mock.calls.filter((c) => c[2] === STRUCTURE_CONTAINER),
    ).toHaveLength(0);
  });
  it('supports a repeated RCL1-to-8 development sequence without exceeding structure caps', () => {
    const f = fixture(1);
    spawner(f);
    source(f);
    source(f, 15, 12);
    const mineral = {
      id: 'mineral',
      pos: pos(10, 40),
      mineralType: 'H',
      mineralAmount: 10000,
    } as Mineral;
    f.minerals.push(mineral);
    objects.set(mineral.id, mineral);
    for (let level = 1; level <= 8; level++) {
      f.room.controller!.level = level;
      for (let round = 0; round < 50; round++) {
        Game.time += 100;
        planRoom(inspectRoom(f.room));
        for (const site of [...f.sites]) {
          structure(f, site.structureType, site.pos.x, site.pos.y);
          delete Game.constructionSites[site.id];
        }
        f.sites.length = 0;
      }
      const counts: Record<string, number> = {};
      for (const s of f.structures) counts[s.structureType] = (counts[s.structureType] ?? 0) + 1;
      for (const [type, count] of Object.entries(counts))
        expect(count, `RCL${level}: ${type}`).toBeLessThanOrEqual(
          CONTROLLER_STRUCTURES[type as BuildableStructureConstant][level],
        );
      expect(counts.extension ?? 0).toBe(CONTROLLER_STRUCTURES[STRUCTURE_EXTENSION][level]);
      expect(counts.tower ?? 0).toBe(CONTROLLER_STRUCTURES[STRUCTURE_TOWER][level]);
    }
    for (const type of [
      STRUCTURE_STORAGE,
      STRUCTURE_TERMINAL,
      STRUCTURE_EXTRACTOR,
      STRUCTURE_FACTORY,
      STRUCTURE_OBSERVER,
      STRUCTURE_POWER_SPAWN,
      STRUCTURE_NUKER,
    ])
      expect(
        f.structures.some((s) => s.structureType === type),
        type,
      ).toBe(true);
    expect(f.structures.filter((s) => s.structureType === STRUCTURE_LAB)).toHaveLength(10);
    expect(f.structures.filter((s) => s.structureType === STRUCTURE_SPAWN)).toHaveLength(3);
    expect(f.structures.filter((s) => s.structureType === STRUCTURE_LINK)).toHaveLength(4);
  });
  it('rebuilds a destroyed spawn at the retained anchor', () => {
    const f = fixture(4);
    const s = spawner(f);
    source(f);
    planRoom(inspectRoom(f.room));
    f.structures.splice(f.structures.indexOf(s), 1);
    delete Game.spawns[s.name];
    f.room.memory.lastPlan = undefined;
    vi.mocked(f.room.createConstructionSite).mockClear();
    planRoom(inspectRoom(f.room));
    expect(f.room.createConstructionSite).toHaveBeenCalledWith(25, 25, STRUCTURE_SPAWN);
  });
  it('throttles planning and respects API placement failures', () => {
    const f = fixture(3);
    spawner(f);
    source(f);
    vi.mocked(f.room.createConstructionSite).mockReturnValue(ERR_INVALID_TARGET);
    planRoom(inspectRoom(f.room));
    expect(f.room.memory.planErrors).toBeGreaterThan(0);
    vi.mocked(f.room.createConstructionSite).mockClear();
    planRoom(inspectRoom(f.room));
    expect(f.room.createConstructionSite).not.toHaveBeenCalled();
  });
});
