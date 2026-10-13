import { beforeEach, vi } from 'vitest';
import { constants } from './constants';
import { Position, objects } from './mock';
Object.assign(globalThis, constants);
Object.assign(globalThis, { RoomPosition: Position });
export function resetWorld(): void {
  Object.assign(globalThis, {
    Memory: { creeps: {}, rooms: {} },
    Game: { time: 100, creeps: {}, spawns: {}, rooms: {}, constructionSites: {},
      cpu: { bucket: 10000, generatePixel: vi.fn(() => OK) },
      map: { describeExits: vi.fn(() => ({ 1: 'W1N2' })) },
      getObjectById: vi.fn((id: string) => objects.get(id) ?? null),
    },
    PathFinder: { search: vi.fn(() => ({ path: [], incomplete: false, cost: 0 })),
      CostMatrix: class { set() {} get() { return 0; } } },
  });
  objects.clear();
}

resetWorld();
beforeEach(resetWorld);
