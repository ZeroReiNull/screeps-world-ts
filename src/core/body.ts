import type { Role } from '../config';
export function bodyCost(body: BodyPartConstant[]): number {
  return body.reduce((cost, part) => cost + BODYPART_COST[part], 0);
}
export function makeBody(role: Role, budget: number, workLimit = 10): BodyPartConstant[] {
  if (role === 'miner' || role === 'mineralMiner') {
    const work = Math.min(workLimit, Math.floor((budget - 100) / 100));
    if (work < 1) return [];
    return [...Array<BodyPartConstant>(work).fill(WORK), CARRY, MOVE];
  }
  if (role === 'defender') {
    // One MOVE per non-MOVE part allows fighting on plains without road dependence.
    const heal = budget >= 800 ? [HEAL, MOVE] as BodyPartConstant[] : [];
    const n = Math.min(16, Math.floor((budget - bodyCost(heal)) / 200));
    if (!n) return [];
    return [...Array<BodyPartConstant>(n).fill(RANGED_ATTACK), ...heal,
      ...Array<BodyPartConstant>(n).fill(MOVE)];
  }
  if (role === 'worker' && budget >= 200 && budget < 250) return [WORK, CARRY, MOVE];
  const segment: BodyPartConstant[] = role === 'hauler' ? [CARRY, MOVE]
    : role === 'upgrader' ? [WORK, CARRY, MOVE] : [WORK, CARRY, MOVE, MOVE];
  const limit = role === 'hauler' ? 16 : role === 'upgrader' ? Math.min(15, workLimit) : 8;
  const n = Math.max(0, Math.min(limit, Math.floor(budget / bodyCost(segment))));
  return Array.from({ length: n }, () => segment).flat();
}
