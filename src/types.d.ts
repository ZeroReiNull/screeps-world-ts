interface Memory {
    uuid: number;
    log: any;
}

interface CreepMemory {
    role: string;
    room: string;
    working: boolean; // Used for state machine switching (e.g., harvesting vs transferring)
}