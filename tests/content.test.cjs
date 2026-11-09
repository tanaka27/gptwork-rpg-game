const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');const {validate,legacy}=require('../shared/content.js');const rules=require('../shared/rules.js');const content=require('../content/game.json');
assert.deepEqual(validate(content),[]);assert.equal(legacy(content).bestiary[0].length,4);
for(const change of [d=>d.monsters[0].id=d.monsters[1].id,d=>d.monsters[0].zoneId='missing',d=>d.nodes[0].links=['dragon'],d=>d.shops[0].itemIds=['missing'],d=>d.skills[0].effects[0].type='eval',d=>d.monsters[0].name='<img src=x>',d=>d.monsters[0].hp=-1,d=>d.rarities[0].rate=2]){const altered=structuredClone(content);change(altered);assert.ok(validate(altered).length);}
const c={Math};vm.createContext(c);vm.runInContext(fs.readFileSync('dist/combat.js','utf8')+';this.rules=CombatRules',c);
assert.equal(rules.skillAmount(content.skills[0],{wisdom:18,attack:10,defense:1},c.rules),42);
assert.equal(rules.enemy(content,0,true).id,'grass_guardian');assert.equal(rules.travelEvent(content.rules.travel,false,.29),'battle');
const state={lv:1,weapon:'twig',armor:'cloth'};assert.equal(rules.stats(state,content).maxHP,80);
console.log('PASS: content IDs, references, links, effects, numeric ranges, HTML rejection and pure game rules');

const expanded=structuredClone(content);expanded.characters.push({...expanded.characters[0],id:'new_hero',name:'新しい仲間'});expanded.zones.push({...expanded.zones[0],id:'new_zone',bossId:'new_boss'});expanded.monsters.push({...expanded.monsters[0],id:'new_monster',zoneId:'new_zone'},{...expanded.monsters.find(m=>m.boss),id:'new_boss',zoneId:'new_zone'});expanded.items.push({...expanded.items[0],id:'new_sword'});expanded.nodes.push({id:'new_node',name:'新しい地点',zoneId:'new_zone',x:50,y:50,links:['home']});expanded.nodes[0].links.push('new_node');assert.deepEqual(validate(expanded),[]);assert.equal(legacy(expanded).zones.length,4);assert.ok(legacy(expanded).gear.new_sword);console.log('PASS: additional characters, areas, monsters, items and bidirectional map nodes are data-only changes');

for(const key of ['baseLuck','luckPerLevel'])for(const invalid of [-1,.5,null,1e9]){const d=structuredClone(content);d.rules.growth[key]=invalid;assert.ok(validate(d).length,key+' rejects invalid luck');}
const old=structuredClone(content);delete old.rules.growth.baseLuck;delete old.rules.growth.luckPerLevel;assert.deepEqual(validate(old),[]);assert.equal(rules.stats({lv:5,weapon:'twig',armor:'cloth'},old).luck,18);

// Support effects remain data driven and cannot enter damage/heal or consumable paths.
const inspire=content.skills.find(s=>s.id==='inspire');assert.ok(inspire);assert.equal(inspire.effect,'buff');
for(const mutation of [
 d=>d.skills.find(s=>s.id==='inspire').effects=[null],
 d=>d.skills.find(s=>s.id==='inspire').effects={},
 d=>d.skills.find(s=>s.id==='inspire').effects[0].multiplier=1,
 d=>d.skills.find(s=>s.id==='inspire').effects[0].multiplier=3.01,
 d=>d.skills.find(s=>s.id==='inspire').effects[0].multiplier=null,
 d=>d.skills.find(s=>s.id==='inspire').effects[0].turns=0,
 d=>d.skills.find(s=>s.id==='inspire').effects[0].turns=1.5,
 d=>d.skills.find(s=>s.id==='inspire').effects[0].turns=100,
 d=>d.skills.find(s=>s.id==='inspire').effects.push({type:'magicDamage',power:1,base:0}),
 d=>d.skills.find(s=>s.id==='inspire').effect='heal',
 d=>d.items.find(s=>s.category==='consumable').effects=[{type:'attackBuff',multiplier:1.5,turns:3}],
]){const changed=structuredClone(content);mutation(changed);assert.ok(validate(changed).length);}
const buffState=()=>({lv:2,weapon:'twig',armor:'cloth',turn:1,hp:97,mp:24,enemy:{hp:100},companions:content.rules.party.slice(1).map(characterId=>({characterId,hp:97,mp:24}))});
let buffed=buffState();const baseAttack=rules.stats(buffed,content).attack;
assert.equal(rules.applyAttackBuff(buffed,content,1,inspire),true);
assert.equal(rules.allyAttack(buffed,content,1),Math.floor(baseAttack*1.5));
assert.equal(rules.allyAttack(buffed,content,0),baseAttack);assert.equal(rules.allyAttack(buffed,content,2),baseAttack);
assert.equal(rules.skillAmount(inspire,{wisdom:50,attack:100},c.rules),0);
assert.deepEqual(rules.tickBuffs(buffed,content),[]);assert.equal(buffed.buffs[0].remainingTurns,3,'applied round does not decrement');
buffed.turn=2;rules.tickBuffs(buffed,content);assert.equal(buffed.buffs[0].remainingTurns,2);
buffed.turn=3;rules.tickBuffs(buffed,content);assert.equal(buffed.buffs[0].remainingTurns,1);
buffed.turn=4;const expired=rules.tickBuffs(buffed,content);assert.equal(expired.length,1);assert.equal(expired[0].skill.name,'鼓舞');assert.equal(buffed.buffs.length,0);assert.equal(rules.allyAttack(buffed,content,1),baseAttack);
assert.equal(rules.applyAttackBuff(buffed,content,0,inspire),true);assert.equal(rules.allyAttack(buffed,content,0),Math.floor(baseAttack*1.5));
const slash=content.skills.find(s=>s.id==='slash'),flame=content.skills.find(s=>s.id==='flame');
const effective=rules.allyAttack(buffed,content,0);
assert.ok(rules.skillResult(slash,{attack:effective,defense:0,luck:512,criticalRoll:0,roll:.5},c.rules).amount>rules.skillResult(slash,{attack:baseAttack,defense:0,luck:512,criticalRoll:0,roll:.5},c.rules).amount);
assert.equal(rules.skillAmount(flame,{wisdom:20,attack:effective},c.rules),rules.skillAmount(flame,{wisdom:20,attack:baseAttack},c.rules));
const other=structuredClone(content);other.skills.push({...structuredClone(inspire),id:'inspire_other'});buffed.turn=5;rules.applyAttackBuff(buffed,other,0,other.skills.at(-1));assert.equal(buffed.buffs.length,1,'same kind replaces even with another skill ID');assert.equal(buffed.buffs[0].skillId,'inspire_other');assert.equal(buffed.buffs[0].remainingTurns,3);rules.tickBuffs(buffed,other);assert.equal(buffed.buffs[0].remainingTurns,3);
for(const invalid of [-1,1.5,4,NaN])assert.equal(rules.applyAttackBuff(buffed,content,invalid,inspire),false);
buffed.companions[1].hp=0;assert.equal(rules.applyAttackBuff(buffed,content,2,inspire),false);assert.equal(rules.applyAttackBuff(buffed,content,0,flame),false);
buffed=buffState();rules.applyAttackBuff(buffed,content,1,inspire);buffed.companions[0].hp=0;rules.normalizeBuffs(buffed,content);assert.deepEqual(buffed.buffs,[]);
buffed=buffState();rules.applyAttackBuff(buffed,content,1,inspire);buffed.enemy=null;rules.normalizeBuffs(buffed,content);assert.deepEqual(buffed.buffs,[]);assert.equal(rules.applyAttackBuff(buffed,content,0,inspire),false);
buffed=buffState();rules.normalizeBuffs(buffed,content);assert.deepEqual(buffed.buffs,[],'old save defaults to no buffs');
buffed.buffs=[null,{characterId:content.rules.party[0],skillId:'missing',remainingTurns:3,appliedTurn:1}];rules.normalizeBuffs(buffed,content);assert.deepEqual(buffed.buffs,[],'invalid local buffs are removed without changing HP');assert.equal(buffed.hp,97);
const saveRules=require('../shared/save.js');
const saved={...buffState(),v:2,xp:0,gold:30,total:0,node:'meadow',lastTown:'home',owned:['twig','cloth'],items:{herb:3},materials:{},kills:[0,0,0],cleared:[false,false,false],log:[]};
assert.deepEqual(saveRules.validate(saved,content),[]);
rules.applyAttackBuff(saved,content,1,inspire);assert.deepEqual(saveRules.validate(saved,content),[]);
for(const mutation of [s=>s.buffs={},s=>s.buffs.push({...s.buffs[0]}),s=>s.buffs[0].remainingTurns=0,s=>s.buffs[0].remainingTurns=4,s=>s.buffs[0].remainingTurns=1.5,s=>s.buffs[0].appliedTurn=2,s=>s.buffs[0].appliedTurn=0,s=>s.buffs[0].characterId='missing',s=>s.buffs[0].skillId='flame']){const changed=structuredClone(saved);mutation(changed);assert.ok(saveRules.validate(changed,content).length);}
const snapshotSave={...structuredClone(saved),battleContent:structuredClone(content)};
const withoutSkill=structuredClone(content);withoutSkill.skills=withoutSkill.skills.filter(s=>s.id!=='inspire');assert.deepEqual(saveRules.validate(snapshotSave,withoutSkill),[],'valid battle snapshot retains buff after active skill removal');
const changedActive=structuredClone(content);changedActive.skills.find(s=>s.id==='inspire').effects[0].turns=1;assert.deepEqual(saveRules.validate(snapshotSave,changedActive),[],'snapshot owns duration validation');
snapshotSave.battleContent.skills.find(s=>s.id==='inspire').effects[0].multiplier=99;assert.ok(saveRules.validate(snapshotSave,content).length,'invalid battle snapshot is rejected');
console.log('PASS: attack buff schema, target-only stats, physical critical/magic separation, duration/refresh, normalization and snapshot-compatible saves');
