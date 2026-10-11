import { ROLE_WORKER, ROLE_MINER } from './config';

declare global {
    interface Memory {
        uuid: number;
        log: any;
        [key: string]: any;
    }

    interface CreepMemory {
        role: string;
        working: boolean;
        sourceId?: Id<Source>;
        targetId?: Id<_HasId>;
        [key: string]: any;
    }
}