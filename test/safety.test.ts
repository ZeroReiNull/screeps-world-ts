import { describe, expect, it, vi } from 'vitest';
import { fixture, creep, pos } from './mock';
import { retreatEconomy } from '../src/core/safety';
import { loop } from '../src/main';
function situation(parts: BodyPartConstant[] = [ATTACK, MOVE]) {
  const f = fixture(2);
  const worker = creep(f, 'worker', [WORK, CARRY, MOVE], { pos: pos(10, 10) });
  const enemy = creep(f, 'defender', parts, { pos: pos(11, 10) });
  delete Game.creeps[enemy.name];
  f.hostiles.push(enemy);
  return { f, worker, enemy };
}
describe('economic retreat', () => {
  it('interrupts work and follows a flee path', () => {
    const { worker } = situation();
    vi.mocked(PathFinder.search).mockReturnValue({
      path: [pos(9, 9)],
      ops: 1,
      cost: 1,
      incomplete: false,
    });
    expect(retreatEconomy(worker)).toBe(true);
    expect(worker.move).toHaveBeenCalled();
  });
  it('does not flee from unarmed scouts or dismantlers alone', () => {
    const { worker } = situation([WORK, MOVE]);
    expect(retreatEconomy(worker)).toBe(false);
  });
  it('resumes work when threats leave and works during safe mode', () => {
    const { f, worker, enemy } = situation();
    f.room.controller!.safeMode = 100;
    expect(retreatEconomy(worker)).toBe(false);
    f.room.controller!.safeMode = undefined;
    enemy.pos = pos(30, 30);
    expect(retreatEconomy(worker)).toBe(false);
  });
  it('does not let a role override retreat movement in the main loop', () => {
    const { worker } = situation();
    loop();
    expect(worker.harvest).not.toHaveBeenCalled();
    expect(worker.build).not.toHaveBeenCalled();
    expect(worker.upgradeController).not.toHaveBeenCalled();
  });
});

describe('retreat hold period', () => {
  it('waits 25 safe ticks before resuming work and extends on renewed danger', () => {
    const { worker, enemy } = situation();
    expect(retreatEconomy(worker)).toBe(true);
    enemy.pos = pos(30, 30);
    Game.time += 20;
    expect(retreatEconomy(worker)).toBe(true);
    enemy.pos = pos(11, 10);
    expect(retreatEconomy(worker)).toBe(true);
    enemy.pos = pos(30, 30);
    Game.time += 10;
    expect(retreatEconomy(worker)).toBe(true);
    Game.time += 15;
    expect(retreatEconomy(worker)).toBe(false);
  });
});

it('stays away while an enemy still camps the original work area', () => {
  const { worker, enemy } = situation();
  retreatEconomy(worker);
  worker.pos = pos(20, 20);
  Game.time += 100;
  expect(retreatEconomy(worker)).toBe(true);
  enemy.pos = pos(40, 40);
  Game.time += 25;
  expect(retreatEconomy(worker)).toBe(false);
});
