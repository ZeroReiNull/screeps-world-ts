import { describe,it,expect,vi } from 'vitest';
import { fixture,source,spawner,creep } from './mock';
import { loop } from '../src/main';
describe('loop integration',()=>{
  it.each([1,2,3,4,5,6,7,8])('runs a full owned-room tick at RCL %i',level=>{
    const f=fixture(level);const s=spawner(f);source(f);creep(f);const log=vi.spyOn(console,'log');
    loop();expect(log).not.toHaveBeenCalled();expect(f.room.memory.stats?.rcl).toBe(level);
    expect(f.room.createConstructionSite).toHaveBeenCalled();expect(Game.cpu.generatePixel).not.toHaveBeenCalled();
  });
  it('one broken creep does not prevent the next creep from running',()=>{
    const f=fixture();spawner(f);source(f);const a=creep(f),b=creep(f);
    vi.mocked(a.harvest).mockImplementation(()=>{throw new Error('test failure');});
    vi.spyOn(console,'log').mockImplementation(()=>{});loop();expect(b.harvest).toHaveBeenCalled();
  });
  it('a failed room snapshot does not prevent another room spawning',()=>{
    const f=fixture(3);const s=spawner(f);source(f);
    vi.mocked(f.room.find).mockImplementationOnce(()=>{throw new Error('snapshot failure');});
    const other=fixture(3,800,'W2N2');const second=spawner(other,'Spawn2');source(other);
    vi.spyOn(console,'log').mockImplementation(()=>{});loop();expect(second.spawnCreep).toHaveBeenCalled();
  });
  it('skips unowned rooms',()=>{
    const f=fixture();f.room.controller!.my=false;loop();expect(f.room.createConstructionSite).not.toHaveBeenCalled();expect(f.room.memory.stats).toBeUndefined();
  });
});
