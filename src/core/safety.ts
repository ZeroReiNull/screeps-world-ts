import { move } from './actions';

const roomCache = new WeakMap<
  Room,
  {
    tick: number;
    hostiles: Creep[];
    allies: Creep[];
    structures: AnyStructure[];
    mine: AnyOwnedStructure[];
  }
>();
function snapshot(room: Room) {
  let data = roomCache.get(room);
  if (!data || data.tick !== Game.time) {
    data = {
      tick: Game.time,
      hostiles: room.find(FIND_HOSTILE_CREEPS),
      allies: room.find(FIND_MY_CREEPS),
      structures: room.find(FIND_STRUCTURES),
      mine: room.find(FIND_MY_STRUCTURES),
    };
    roomCache.set(room, data);
  }
  return data;
}

export function canAttackCreeps(creep: Creep): boolean {
  return creep.getActiveBodyparts(ATTACK) > 0 || creep.getActiveBodyparts(RANGED_ATTACK) > 0;
}

export function protectedAt(creep: Creep): boolean {
  return snapshot(creep.room).mine.some(
    (s) => s.structureType === STRUCTURE_RAMPART && s.hits > 0 && s.pos.isEqualTo(creep.pos),
  );
}

/** Interrupt economic work only when a combatant is nearby. Re-evaluate every tick. */
export function retreatEconomy(creep: Creep): boolean {
  if (creep.memory.role === 'defender') return false;
  if (creep.room.controller?.safeMode) {
    delete creep.memory.retreatUntil;
    delete creep.memory.retreatFrom;
    return false;
  }
  const threats = snapshot(creep.room).hostiles.filter(canAttackCreeps);
  const danger = threats.some((enemy) => creep.pos.inRangeTo(enemy, 5));
  if (danger) {
    creep.memory.retreatUntil = Game.time + 25;
    creep.memory.retreatFrom ??= { x: creep.pos.x, y: creep.pos.y, roomName: creep.room.name };
  }
  if (!danger) {
    const from = creep.memory.retreatFrom;
    if (
      from?.roomName === creep.room.name &&
      threats.some((enemy) => enemy.pos.inRangeTo(from.x, from.y, 6))
    ) {
      creep.memory.retreatUntil = Game.time + 25;
      return true;
    }
    if (creep.memory.retreatUntil && Game.time < creep.memory.retreatUntil) return true;
    delete creep.memory.retreatUntil;
    delete creep.memory.retreatFrom;
    return false;
  }
  if (protectedAt(creep)) return true;

  const occupied = snapshot(creep.room).allies;
  const shelter = creep.pos.findClosestByPath(
    snapshot(creep.room).mine.filter(
      (s) =>
        s.structureType === STRUCTURE_RAMPART &&
        s.hits > 0 &&
        !occupied.some((c) => c.name !== creep.name && c.pos.isEqualTo(s.pos)) &&
        !threats.some((enemy) => enemy.pos.inRangeTo(s, 3)) &&
        !snapshot(creep.room).structures.some(
          (other) =>
            other.pos.isEqualTo(s.pos) &&
            (OBSTACLE_OBJECT_TYPES as readonly string[]).includes(other.structureType),
        ),
    ),
  );
  // Flee first when already in attack range; do not route through an attacker to shelter.
  if (shelter && !threats.some((enemy) => creep.pos.inRangeTo(enemy, 3))) {
    move(creep, shelter, 0);
    return true;
  }
  const escape = PathFinder.search(
    creep.pos,
    threats.map((enemy) => ({ pos: enemy.pos, range: 6 })),
    {
      flee: true,
      maxRooms: 1,
      roomCallback: () => {
        const costs = new PathFinder.CostMatrix();
        for (const s of snapshot(creep.room).structures) {
          if (
            (OBSTACLE_OBJECT_TYPES as readonly string[]).includes(s.structureType) ||
            (s.structureType === STRUCTURE_RAMPART &&
              !(s as StructureRampart).my &&
              !(s as StructureRampart).isPublic)
          )
            costs.set(s.pos.x, s.pos.y, 255);
        }
        for (const c of [...occupied, ...threats])
          if (c.name !== creep.name) costs.set(c.pos.x, c.pos.y, 255);
        for (let i = 0; i < 50; i++) {
          costs.set(i, 0, 255);
          costs.set(i, 49, 255);
          costs.set(0, i, 255);
          costs.set(49, i, 255);
        }
        return costs;
      },
    },
  );
  if (escape.path.length) creep.move(creep.pos.getDirectionTo(escape.path[0]));
  return true;
}
