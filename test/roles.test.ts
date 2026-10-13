import { describe,it,expect,vi } from 'vitest';
import { fixture,source,structure,spawner,creep,pos,store,objects } from './mock';
import { RoleWorker } from '../src/roles/RoleWorker';
import { RoleMiner } from '../src/roles/RoleMiner';
import { RoleHauler } from '../src/roles/RoleHauler';
import { RoleUpgrader } from '../src/roles/RoleUpgrader';
import { RoleMineralMiner } from '../src/roles/RoleMineralMiner';
import { memory } from '../src/core/memory';
describe('worker',()=>{
  it('handles empty rooms without lodash or a source-zero crash',()=>{
    const f=fixture();const c=creep(f);expect(()=>RoleWorker.run(c)).not.toThrow();expect(c.harvest).not.toHaveBeenCalled();
  });
  it('refills spawn before building',()=>{
    const f=fixture();const s=spawner(f);s.store=store({energy:0},300);
    const c=creep(f,'worker',[WORK,CARRY,MOVE],{store:store({energy:50},50)});
    f.room.createConstructionSite(27,27,STRUCTURE_EXTENSION);
    RoleWorker.run(c);expect(c.transfer).toHaveBeenCalledWith(s,RESOURCE_ENERGY);expect(c.build).not.toHaveBeenCalled();
  });
  it('prevents downgrade before refilling',()=>{
    const f=fixture(4);const s=spawner(f);s.store=store({},300);f.room.controller!.ticksToDowngrade=500;
    const c=creep(f,'worker',[WORK,CARRY,MOVE],{store:store({energy:50},50)});
    RoleWorker.run(c);expect(c.upgradeController).toHaveBeenCalledWith(f.room.controller);expect(c.transfer).not.toHaveBeenCalled();
  });
  it('construction takes priority over routine repairs',()=>{
    const f=fixture(3);spawner(f);const road=structure(f,STRUCTURE_ROAD,27,25);road.hits=4000;
    f.room.createConstructionSite(28,25,STRUCTURE_TOWER);
    const c=creep(f,'worker',[WORK,CARRY,MOVE],{store:store({energy:50},50)});
    RoleWorker.run(c);expect(c.build).toHaveBeenCalled();expect(c.repair).not.toHaveBeenCalled();
  });
  it('recovers energy from tombstones',()=>{
    const f=fixture();const remains={pos:pos(25,26),store:store({energy:100})} as Tombstone;f.tombstones.push(remains);
    const c=creep(f);RoleWorker.run(c);expect(c.withdraw).toHaveBeenCalledWith(remains,RESOURCE_ENERGY);
  });
  it('never repairs an enemy structure',()=>{
    const f=fixture(3);const enemy=structure<StructureTower>(f,STRUCTURE_TOWER);enemy.my=false;enemy.hits=1;
    const c=creep(f,'worker',[WORK,CARRY,MOVE],{store:store({energy:50},50)});
    RoleWorker.run(c);expect(c.repair).not.toHaveBeenCalled();
  });
});
describe('miner',()=>{
  it('does not crash when its source disappears',()=>{
    const f=fixture();const c=creep(f,'miner');c.memory.sourceId='missing' as Id<Source>;
    RoleMiner.run(c);expect(c.memory.sourceId).toBeUndefined();
  });
  it('does not force two partial miners onto the same container',()=>{
    const f=fixture(2);const src=source(f);const container=structure<StructureContainer>(f,STRUCTURE_CONTAINER,11,10);
    const first=creep(f,'miner',[WORK,CARRY,MOVE],{pos:container.pos});first.memory.sourceId=src.id;
    const second=creep(f,'miner',[WORK,CARRY,MOVE],{pos:pos(10,11),store:store({energy:20},50)});second.memory.sourceId=src.id;
    RoleMiner.run(second);expect(second.moveTo).not.toHaveBeenCalled();expect(second.transfer).toHaveBeenCalledWith(container,RESOURCE_ENERGY);expect(second.harvest).toHaveBeenCalledWith(src);
  });
  it('keeps harvesting while delivering energy to a link',()=>{
    const f=fixture(5);const src=source(f);const c=creep(f,'miner',[WORK,CARRY,MOVE],{pos:pos(11,10),store:store({energy:20},50)});c.memory.sourceId=src.id;
    structure(f,STRUCTURE_CONTAINER,11,10);const link=structure<StructureLink>(f,STRUCTURE_LINK,12,10,0,800);
    RoleMiner.run(c);expect(c.transfer).toHaveBeenCalledWith(link,RESOURCE_ENERGY);expect(c.harvest).toHaveBeenCalledWith(src);
  });
});
describe('hauler',()=>{
  it('does not withdraw storage energy only to put it back',()=>{
    const f=fixture(4,1300);spawner(f);structure(f,STRUCTURE_STORAGE,26,25,100000,1000000);const c=creep(f,'hauler',[CARRY,MOVE]);
    RoleHauler.run(c);expect(c.withdraw).not.toHaveBeenCalled();expect(c.transfer).not.toHaveBeenCalled();
  });
  it('may use the final storage energy to refill an empty spawn',()=>{
    const f=fixture(4,1300);const s=spawner(f);s.store=store({},300);f.room.energyAvailable=0;
    const storage=structure(f,STRUCTURE_STORAGE,26,25,10,1000000);const c=creep(f,'hauler',[CARRY,MOVE]);
    RoleHauler.run(c);expect(c.withdraw).toHaveBeenCalledWith(storage,RESOURCE_ENERGY);
  });
  it('does not withdraw the controller container and refill it in a loop',()=>{
    const f=fixture(3,800);spawner(f);structure(f,STRUCTURE_CONTAINER,39,40,300);const c=creep(f,'hauler',[CARRY,MOVE]);
    RoleHauler.run(c);expect(c.withdraw).not.toHaveBeenCalled();
  });
  it('collects mineral containers even when storage has energy',()=>{
    const f=fixture(6,2300);spawner(f);structure(f,STRUCTURE_STORAGE,26,25,100000,1000000);
    const container=structure<StructureContainer>(f,STRUCTURE_CONTAINER,30,30);container.store=store({H:100},2000);
    const c=creep(f,'hauler',[CARRY,MOVE]);RoleHauler.run(c);expect(c.withdraw).toHaveBeenCalledWith(container,'H');
  });
  it('delivers a partial mineral load without waiting to fill up with energy',()=>{
    const f=fixture(6,2300);spawner(f);const storage=structure(f,STRUCTURE_STORAGE,26,25,100000,1000000);
    const c=creep(f,'hauler',[CARRY,MOVE],{store:store({H:10},50)});RoleHauler.run(c);
    expect(c.transfer).toHaveBeenCalledWith(storage,'H');expect(c.withdraw).not.toHaveBeenCalled();
  });
  it('delivers partial energy during a spawn shortage',()=>{
    const f=fixture(3,800);const s=spawner(f);s.store=store({},300);f.room.energyAvailable=0;
    const c=creep(f,'hauler',[CARRY,MOVE],{store:store({energy:10},50)});RoleHauler.run(c);expect(c.transfer).toHaveBeenCalledWith(s,RESOURCE_ENERGY);
  });
  it('feeds workers directly before storage unlocks',()=>{
    const f=fixture(3,800);spawner(f);const worker=creep(f);
    const c=creep(f,'hauler',[CARRY,MOVE],{store:store({energy:50},50)});RoleHauler.run(c);expect(c.transfer).toHaveBeenCalledWith(worker,RESOURCE_ENERGY);
  });
  it('loads terminal mineral reserves when no energy work remains',()=>{
    const f=fixture(6,2300);spawner(f);const storage=structure<StructureStorage>(f,STRUCTURE_STORAGE,26,25,100000,1000000);storage.store.H=10000;
    structure(f,STRUCTURE_TERMINAL,27,25,10000,300000);const c=creep(f,'hauler',[CARRY,MOVE]);
    RoleHauler.run(c);expect(c.withdraw).toHaveBeenCalledWith(storage,'H',50);
  });
});
describe('upgrader and minerals',()=>{
  it('upgrader consumes a controller link before harvesting',()=>{
    const f=fixture(5);const link=structure<StructureLink>(f,STRUCTURE_LINK,39,40,500,800);const c=creep(f,'upgrader');
    RoleUpgrader.run(c);expect(c.withdraw).toHaveBeenCalledWith(link,RESOURCE_ENERGY);expect(c.harvest).not.toHaveBeenCalled();
  });
  it('mineral miner respects extractor cooldown',()=>{
    const f=fixture(6);structure(f,STRUCTURE_STORAGE,26,25,100000,1000000);
    const mineral={id:'mineral',pos:pos(10,10),mineralType:'H',mineralAmount:10000} as Mineral;objects.set(mineral.id,mineral);
    const container=structure<StructureContainer>(f,STRUCTURE_CONTAINER,11,10);const extractor=structure<StructureExtractor>(f,STRUCTURE_EXTRACTOR,10,10);extractor.cooldown=3;
    const c=creep(f,'mineralMiner',[WORK,CARRY,MOVE],{pos:container.pos});c.memory.mineralId=mineral.id;
    RoleMineralMiner.run(c);expect(c.harvest).not.toHaveBeenCalled();extractor.cooldown=0;
    RoleMineralMiner.run(c);expect(c.harvest).toHaveBeenCalledWith(mineral);
  });
});
describe('memory',()=>{
  it('removes dead memory but preserves in-progress spawning',()=>{
    const f=fixture();const s=spawner(f);s.spawning={name:'Pending'} as Spawning;
    Memory.creeps.Dead={role:'worker',working:false};Memory.creeps.Pending={role:'worker',working:false};
    const living=creep(f);memory.clearDeadCreeps();
    expect(Memory.creeps.Dead).toBeUndefined();expect(Memory.creeps.Pending).toBeDefined();expect(Memory.creeps[living.name]).toBeDefined();
  });
});
