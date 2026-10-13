import { describe,it,expect } from 'vitest';
import { fixture,source,structure,store,objects } from './mock';
import { inspectRoom } from '../src/core/room';
import { runStructures } from '../src/core/structures';
describe('links and industry',()=>{
  it('does not overfill one receiver using two source links in the same tick',()=>{
    const f=fixture(8);source(f,10,10);source(f,15,15);
    const a=structure<StructureLink>(f,STRUCTURE_LINK,11,10,700,800),b=structure<StructureLink>(f,STRUCTURE_LINK,16,15,700,800);
    const receiver=structure<StructureLink>(f,STRUCTURE_LINK,39,40,0,800);
    runStructures(inspectRoom(f.room));expect(a.transferEnergy).toHaveBeenCalledWith(receiver,700);expect(b.transferEnergy).toHaveBeenCalledWith(receiver,100);
  });
  it('skips source links while cooling down',()=>{
    const f=fixture(5);source(f);const a=structure<StructureLink>(f,STRUCTURE_LINK,11,10,700,800);a.cooldown=5;structure(f,STRUCTURE_LINK,26,25,0,800);
    runStructures(inspectRoom(f.room));expect(a.transferEnergy).not.toHaveBeenCalled();
  });
  it('runs only explicitly configured valid lab reactions',()=>{
    const f=fixture(6);const a=structure<StructureLab>(f,STRUCTURE_LAB,20,20),b=structure<StructureLab>(f,STRUCTURE_LAB,21,20),out=structure<StructureLab>(f,STRUCTURE_LAB,20,21);
    a.mineralType='H';b.mineralType='O';f.room.memory.labReaction={inputs:[a.id,b.id],outputs:[out.id]};
    runStructures(inspectRoom(f.room));expect(out.runReaction).toHaveBeenCalledWith(a,b);
    out.cooldown=10;runStructures(inspectRoom(f.room));expect(out.runReaction).toHaveBeenCalledOnce();
  });
  it('factory waits for all ingredients and explicit product',()=>{
    const f=fixture(7);const factory=structure<StructureFactory>(f,STRUCTURE_FACTORY);factory.store=store({energy:500},50000);
    runStructures(inspectRoom(f.room));expect(factory.produce).not.toHaveBeenCalled();f.room.memory.factoryProduct='battery';
    runStructures(inspectRoom(f.room));expect(factory.produce).not.toHaveBeenCalled();factory.store.energy=600;
    runStructures(inspectRoom(f.room));expect(factory.produce).toHaveBeenCalledWith('battery');
  });
  it('power processing requires an opt-in and actual power/energy',()=>{
    const f=fixture(8);const ps=structure<StructurePowerSpawn>(f,STRUCTURE_POWER_SPAWN);ps.store=store({energy:50,power:1});
    runStructures(inspectRoom(f.room));expect(ps.processPower).not.toHaveBeenCalled();f.room.memory.processPower=true;
    runStructures(inspectRoom(f.room));expect(ps.processPower).toHaveBeenCalledOnce();
  });
});
