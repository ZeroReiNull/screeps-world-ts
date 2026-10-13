import { describe, it, expect } from 'vitest';
import { makeBody, bodyCost } from '../src/core/body';
import type { Role } from '../src/config';
const roles: Role[] = ['worker', 'miner', 'hauler', 'upgrader', 'defender', 'mineralMiner'];
describe('body sizing', () => {
  it.each(roles)('%s bodies respect energy budget and 50-part limit across capacities', (role) => {
    for (let budget = 0; budget <= 12900; budget += 50) {
      const body = makeBody(role, budget);
      expect(bodyCost(body)).toBeLessThanOrEqual(budget);
      expect(body.length).toBeLessThanOrEqual(50);
      if (body.length) expect(body).toContain(MOVE);
    }
  });
  it('supports a 200-energy recovery worker', () =>
    expect(makeBody('worker', 200)).toEqual([WORK, CARRY, MOVE]));
  it('does not invent unaffordable WORK below 200 energy', () =>
    expect(makeBody('miner', 150)).toEqual([]));
  it('sizes 550-energy miners to four WORK and 600-energy miners to five', () => {
    expect(makeBody('miner', 550, 5).filter((p) => p === WORK)).toHaveLength(4);
    expect(bodyCost(makeBody('miner', 600, 5))).toBe(600);
  });
  it('caps RCL8 upgrading at 15 WORK', () =>
    expect(makeBody('upgrader', 12900, 15).filter((p) => p === WORK)).toHaveLength(15));
  it('gives large defenders healing and enough MOVE for plains', () => {
    const body = makeBody('defender', 3000);
    expect(body).toContain(HEAL);
    expect(body.filter((p) => p === MOVE).length).toBe(body.filter((p) => p !== MOVE).length);
  });
});
