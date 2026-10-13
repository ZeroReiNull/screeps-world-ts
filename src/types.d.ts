import type { Role } from './config';
import type { CONFIG } from './config';
declare global {
  const console: { log(...values: unknown[]): void };
  interface Memory {
    cpuPolicy?: { generatePixel?: boolean };
    cpuStats?: {
      tick: number;
      used: number;
      average: number;
      bucket: number;
      recovering: boolean;
      safeTicks: number;
      pixelResult?: number;
      lastPixel?: number;
    };
  }
  interface CreepMemory {
    role: Role;
    working: boolean;
    home?: string;
    retreatUntil?: number;
    retreatFrom?: { x: number; y: number; roomName: string };
    sourceId?: Id<Source>;
    mineralId?: Id<Mineral>;
  }
  interface RoomMemory {
    settings?: Partial<typeof CONFIG>;
    anchor?: { x: number; y: number };
    lastPlan?: number;
    energyOverflow?: { since?: number; active: boolean };
    haulPaths?: Record<string, { distance: number; tick: number; anchor: string }>;
    planErrors?: number;
    lastThreat?: number;
    stats?: {
      tick: number;
      rcl: number;
      energy: number;
      stored: number;
      hostiles: number;
      targets: Record<string, number>;
    };
    /** Opt-in production: resource must be a valid factory recipe, labs must already contain reagents. */
    factoryProduct?: CommoditiesTypes;
    labReaction?: { inputs: [Id<StructureLab>, Id<StructureLab>]; outputs: Id<StructureLab>[] };
    processPower?: boolean;
  }
}
export {};
