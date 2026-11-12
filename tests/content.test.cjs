const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');const {validate,legacy,withJobs}=require('../shared/content.js');const rules=require('../shared/rules.js');const content=require('../content/game.json');
assert.deepEqual(validate(content),[]);assert.equal(legacy(content).bestiary[0].length,4);
assert.deepEqual(content.characters.map(c=>c.job),['星剣士','弓使い','戦士','僧侶']);
assert.deepEqual(content.rules.party.map(id=>rules.skillsForCharacter(content,id).length),[5,2,2,2]);
assert.equal(content.skills.filter(s=>s.characterId===undefined).length,0,'all bundled skills state their owner');
for(const mutate of [d=>d.skills[0].characterId='unknown',d=>d.skills[0].target='self',d=>d.skills.find(s=>s.id==='gald_kiai').target='enemy']){const changed=structuredClone(content);mutate(changed);assert.ok(validate(changed).length,'owner and target fields are checked');}
for(const change of [d=>d.monsters[0].id=d.monsters[1].id,d=>d.monsters[0].zoneId='missing',d=>d.nodes[0].links=['dragon'],d=>d.shops[0].itemIds=['missing'],d=>d.skills[0].effects[0].type='eval',d=>d.monsters[0].name='<img src=x>',d=>d.monsters[0].hp=-1,d=>d.rarities[0].rate=2]){const altered=structuredClone(content);change(altered);assert.ok(validate(altered).length);}
const c={Math};vm.createContext(c);vm.runInContext(fs.readFileSync('dist/combat.js','utf8')+';this.rules=CombatRules',c);
assert.equal(rules.skillAmount(content.skills[0],{wisdom:18,attack:10,defense:1},c.rules),42);
assert.equal(rules.enemy(content,0,true).id,'grass_guardian');assert.equal(rules.travelEvent(content.rules.travel,false,.29),'battle');
const state={lv:1,weapon:'twig',armor:'cloth'};assert.equal(rules.stats(state,content).maxHP,80);
// Legacy definitions receive standard jobs and skills only when job is missing.
const oldDefinition=structuredClone(content);oldDefinition.skills=oldDefinition.skills.filter(s=>!['rina_aimed_shot','rina_comet_arrow','gald_kiai','gald_full_power_slash','noel_prayer_light','noel_holy_light'].includes(s.id));for(const character of oldDefinition.characters)delete character.job;for(const skill of oldDefinition.skills)delete skill.characterId;
const supplemented=withJobs(oldDefinition,content);
assert.deepEqual(supplemented.characters.map(c=>c.job),['星剣士','弓使い','戦士','僧侶']);
assert.deepEqual(supplemented.rules.party.map(id=>rules.skillsForCharacter(supplemented,id).length),[5,2,2,2]);
assert.equal(oldDefinition.skills.some(s=>s.id==='rina_aimed_shot'),false,'fallback does not mutate input');
supplemented.skills.find(s=>s.id==='gald_kiai').effects[0].turns=88;assert.equal(content.skills.find(s=>s.id==='gald_kiai').effects[0].turns,3,'nested fallback effects are independent copies');
const custom=structuredClone(oldDefinition);custom.characters.find(c=>c.id==='rina').job='野伏';custom.skills=custom.skills.filter(s=>!['rina_aimed_shot','rina_comet_arrow'].includes(s.id));const customResult=withJobs(custom,content);
assert.equal(customResult.characters.find(c=>c.id==='rina').job,'野伏');assert.equal(rules.skillsForCharacter(customResult,'rina').length,0,'explicit custom job preserves deliberate skill removal');
const unknown=structuredClone(oldDefinition);unknown.characters[1]={id:'traveler',name:'旅人',speed:9};unknown.rules.party[1]='traveler';const unknownResult=withJobs(unknown,content);
assert.equal(unknownResult.characters[1].job,'冒険者');assert.equal(rules.skillsForCharacter(unknownResult,'traveler').length,0);
const colliding=structuredClone(oldDefinition);colliding.skills.push({...structuredClone(content.skills.find(s=>s.id==='rina_aimed_shot')),characterId:'astel'});
const collisionResult=withJobs(colliding,content),fallbackCollision=collisionResult.skills.find(s=>s.characterId==='rina'&&s.name==='ねらい撃ち');
assert.ok(fallbackCollision&&fallbackCollision.id!=='rina_aimed_shot'&&fallbackCollision.id.length<=64&&/^[a-z][a-z0-9_-]*$/.test(fallbackCollision.id));
assert.equal(collisionResult.skills.find(s=>s.id==='rina_aimed_shot').characterId,'astel','custom collision owner is untouched');
assert.deepEqual(withJobs(collisionResult,content),collisionResult,'fallback is deterministic and idempotent');
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
assert.equal(rules.allyAttack(buffed,content,1),Math.floor(rules.stats(buffed,content,1).attack*1.5));
assert.equal(rules.allyAttack(buffed,content,0),baseAttack);assert.equal(rules.allyAttack(buffed,content,2),rules.stats(buffed,content,2).attack);
assert.equal(rules.skillAmount(inspire,{wisdom:50,attack:100},c.rules),0);
assert.deepEqual(rules.tickBuffs(buffed,content),[]);assert.equal(buffed.buffs[0].remainingTurns,3,'applied round does not decrement');
buffed.turn=2;rules.tickBuffs(buffed,content);assert.equal(buffed.buffs[0].remainingTurns,2);
buffed.turn=3;rules.tickBuffs(buffed,content);assert.equal(buffed.buffs[0].remainingTurns,1);
buffed.turn=4;const expired=rules.tickBuffs(buffed,content);assert.equal(expired.length,1);assert.equal(expired[0].skill.name,'鼓舞');assert.equal(buffed.buffs.length,0);assert.equal(rules.allyAttack(buffed,content,1),rules.stats(buffed,content,1).attack);
assert.equal(rules.applyAttackBuff(buffed,content,0,inspire),true);assert.equal(rules.allyAttack(buffed,content,0),Math.floor(baseAttack*1.5));
const galdBuff=buffState(),kiai=content.skills.find(s=>s.id==='gald_kiai');
assert.equal(rules.applyAttackBuff(galdBuff,content,2,kiai,2),true,'the owner may apply a self-only buff to themself');
assert.equal(rules.allyAttack(galdBuff,content,2),Math.floor(rules.stats(galdBuff,content,2).attack*1.5));
assert.equal(rules.applyAttackBuff(galdBuff,content,1,kiai,2),false,'self-only buff cannot target another ally');
assert.equal(rules.applyAttackBuff(galdBuff,content,2,kiai,0),false,'another actor cannot invoke Gald’s skill');
const misplaced=structuredClone(galdBuff);misplaced.buffs[0].characterId='noel';assert.deepEqual(rules.normalizeBuffs(misplaced,content),[],'self-only buff snapshots cannot be assigned to another character');
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
const questRules=require('../shared/quests.js');
for(const claimed of [false,true])assert.deepEqual(saveRules.validate({...saved,claimed},content),[],'legacy v:2 save without quest state remains valid');
const questSave={...saved,claimed:false,questState:{active:{id:'apprentice_hunt',acceptedAtTotal:0},completedIds:[]}};
assert.deepEqual(saveRules.validate(questSave,content),[],'valid accepted quest state is cloud-save compatible');
assert.deepEqual(saveRules.validate({...saved,claimed:true,questState:questRules.initialState(true)},content),[],'claimed legacy reward migrates to completed quest state');
for(const mutation of [s=>s.questState.active.id='unknown',s=>s.questState.active.acceptedAtTotal=1,s=>s.questState.completedIds=['unknown'],s=>s.questState.completedIds=['apprentice_hunt','apprentice_hunt'],s=>s.questState.completedIds=['apprentice_hunt'],s=>{s.questState.active=null;s.questState.completedIds=['village_bounty']},s=>s.questState.completedIds=['apprentice_hunt','village_bounty']]){const changed=structuredClone(questSave);mutation(changed);assert.ok(saveRules.validate(changed,content).length,'invalid quest save is rejected');}
rules.applyAttackBuff(saved,content,1,inspire);assert.deepEqual(saveRules.validate(saved,content),[]);
for(const mutation of [s=>s.buffs={},s=>s.buffs.push({...s.buffs[0]}),s=>s.buffs[0].remainingTurns=0,s=>s.buffs[0].remainingTurns=4,s=>s.buffs[0].remainingTurns=1.5,s=>s.buffs[0].appliedTurn=2,s=>s.buffs[0].appliedTurn=0,s=>s.buffs[0].characterId='missing',s=>s.buffs[0].skillId='flame']){const changed=structuredClone(saved);mutation(changed);assert.ok(saveRules.validate(changed,content).length);}
const snapshotSave={...structuredClone(saved),battleContent:structuredClone(content)};
const withoutSkill=structuredClone(content);withoutSkill.skills=withoutSkill.skills.filter(s=>s.id!=='inspire');assert.deepEqual(saveRules.validate(snapshotSave,withoutSkill),[],'valid battle snapshot retains buff after active skill removal');
const changedActive=structuredClone(content);changedActive.skills.find(s=>s.id==='inspire').effects[0].turns=1;assert.deepEqual(saveRules.validate(snapshotSave,changedActive),[],'snapshot owns duration validation');
snapshotSave.battleContent.skills.find(s=>s.id==='inspire').effects[0].multiplier=99;assert.ok(saveRules.validate(snapshotSave,content).length,'invalid battle snapshot is rejected');
const oldRaritySnapshot=structuredClone(content),oldRarityMap={common:'normal',uncommon:'rare',rare:'epic',legendary:'legend'};for(const item of oldRaritySnapshot.items.filter(item=>item.category==='gear'))item.rarity=oldRarityMap[item.rarity];const oldRaritySave={...structuredClone(saved),enemy:{name:'旧定義の敵',hp:10,max:10},battleContent:oldRaritySnapshot};assert.deepEqual(saveRules.validate(oldRaritySave,content),[],'v:2 validation accepts an old battle definition after clone normalization');assert.deepEqual(oldRaritySnapshot.items.filter(item=>item.category==='gear').map(item=>item.rarity),['normal','normal','normal','normal','normal','normal','rare','rare','epic','legend'],'snapshot validation does not change the saved input');
const gearRows=content.items.filter(item=>item.category==='gear');assert.deepEqual(gearRows.map(item=>item.rarity),['common','common','common','common','common','common','uncommon','uncommon','rare','legendary']);assert.deepEqual(gearRows.slice(0,6).map(item=>item.bonusEffects),Array.from({length:6},()=>[]));
for(const id of ['moonsteel_blade','starward_armor','eclipse_robe','starlight_blade'])assert.ok(content.items.some(item=>item.id===id&&item.category==='gear'));
for(const mutation of [d=>d.items.find(i=>i.id==='moonsteel_blade').bonusEffects=[],d=>d.items.find(i=>i.id==='eclipse_robe').bonusEffects.pop(),d=>d.items.find(i=>i.id==='starlight_blade').bonusEffects[0].stat='invalid',d=>d.items.find(i=>i.id==='starward_armor').bonusEffects[0].amount=0,d=>d.items.find(i=>i.id==='starlight_blade').bonusEffects[1].stat='attack',d=>d.shops.find(s=>s.id==='luna').itemIds.push('eclipse_robe'),d=>d.shops.find(s=>s.id==='forge').itemIds.push('starlight_blade'),d=>d.zones[0].equipmentDropIds=['herb'],d=>d.zones[0].equipmentDropIds=['iron','iron'],d=>d.zones[0].equipmentDropIds=['missing']]){const changed=structuredClone(content);mutation(changed);assert.ok(validate(changed).length,'equipment schema and shop/drop restrictions reject invalid definitions');}
const invalidNewRare=structuredClone(content);invalidNewRare.items.find(i=>i.id==='eclipse_robe').bonusEffects.pop();assert.ok(validate(invalidNewRare).length,'new rare equipment requires two effects');
const oldRarityDefinition=structuredClone(content),oldRarityIds={common:'normal',uncommon:'rare',rare:'epic',legendary:'legend'};for(const item of oldRarityDefinition.items.filter(item=>item.category==='gear'))item.rarity=oldRarityIds[item.rarity];assert.ok(validate(oldRarityDefinition).length,'strict validator rejects the retired equipment IDs');const migratedRarities=withJobs(oldRarityDefinition,content);assert.deepEqual(migratedRarities.items.filter(item=>item.category==='gear').map(item=>item.rarity),gearRows.map(item=>item.rarity));assert.deepEqual(oldRarityDefinition.items.filter(item=>item.category==='gear').map(item=>item.rarity),['normal','normal','normal','normal','normal','normal','rare','rare','epic','legend'],'published raw definition remains unchanged');assert.deepEqual(withJobs(oldRarityDefinition).items.filter(item=>item.category==='gear').map(item=>item.rarity),gearRows.map(item=>item.rarity),'single-argument compatibility also normalizes its default definition');
const oldRareOnly=structuredClone(content);oldRareOnly.items.find(item=>item.id==='moonsteel_blade').rarity='rare';for(const item of oldRareOnly.items.filter(item=>item.category==='gear'&&item.id!=='moonsteel_blade')){delete item.rarity;delete item.bonusEffects;}const oldRareInput=structuredClone(oldRareOnly),oldRareResult=withJobs(oldRareOnly,content);assert.equal(oldRareResult.items.find(item=>item.id==='moonsteel_blade').rarity,'uncommon','old rare with one effect maps to uncommon without legacy normal/epic/legend markers');assert.deepEqual(oldRareOnly,oldRareInput,'old rare conversion does not mutate input');
const legacyEquipment=structuredClone(content);legacyEquipment.items=legacyEquipment.items.filter(item=>!['moonsteel_blade','starward_armor','eclipse_robe','starlight_blade'].includes(item.id));for(const item of legacyEquipment.items.filter(item=>item.category==='gear')){delete item.rarity;delete item.bonusEffects;}for(const zone of legacyEquipment.zones)delete zone.equipmentDropIds;for(const shop of legacyEquipment.shops)shop.itemIds=shop.itemIds.filter(id=>!['moonsteel_blade','starward_armor'].includes(id));
const legacyRuntime=withJobs(legacyEquipment,content);assert.deepEqual(validate(legacyRuntime),[]);assert.deepEqual(legacyEquipment.items.filter(item=>item.category==='gear').map(item=>item.rarity),Array(6).fill(undefined),'legacy fallback does not mutate the published definition');assert.deepEqual(legacyRuntime.items.filter(item=>item.category==='gear').map(item=>item.rarity),['common','common','common','common','common','common','uncommon','uncommon','rare','legendary']);assert.ok(legacyRuntime.zones.find(zone=>zone.id==='grassland').equipmentDropIds.includes('iron'));assert.ok(legacyRuntime.zones.find(zone=>zone.id==='moon_ruins').equipmentDropIds.includes('eclipse_robe'));assert.ok(legacyRuntime.zones.find(zone=>zone.id==='volcano').equipmentDropIds.includes('starlight_blade'));assert.ok(legacyRuntime.shops.find(shop=>shop.nodeId==='luna').itemIds.includes('moonsteel_blade'));assert.ok(legacyRuntime.shops.find(shop=>shop.nodeId==='forge').itemIds.includes('starward_armor'));assert.deepEqual(withJobs(legacyRuntime,content),legacyRuntime,'equipment compatibility supplementation is idempotent');
const explicitEquipment=structuredClone(legacyRuntime);explicitEquipment.shops.find(shop=>shop.nodeId==='luna').itemIds=explicitEquipment.shops.find(shop=>shop.nodeId==='luna').itemIds.filter(id=>id!=='moonsteel_blade');explicitEquipment.zones.find(zone=>zone.id==='moon_ruins').equipmentDropIds=['leather'];const explicitRuntime=withJobs(explicitEquipment,content);assert.deepEqual(explicitRuntime.shops.find(shop=>shop.nodeId==='luna').itemIds,explicitEquipment.shops.find(shop=>shop.nodeId==='luna').itemIds);assert.deepEqual(explicitRuntime.zones.find(zone=>zone.id==='moon_ruins').equipmentDropIds,['leather'],'explicit shop and drop settings are respected');
const customLegacy=structuredClone(legacyEquipment);customLegacy.items.find(item=>item.id==='iron').id='custom_iron';customLegacy.zones.find(zone=>zone.id==='grassland').bonusItemId='custom_iron';customLegacy.shops.find(shop=>shop.nodeId==='luna').itemIds=customLegacy.shops.find(shop=>shop.nodeId==='luna').itemIds.map(id=>id==='iron'?'custom_iron':id);const customRuntime=withJobs(customLegacy,content);assert.deepEqual(validate(customRuntime),[]);assert.equal(customRuntime.zones.find(zone=>zone.id==='grassland').bonusItemId,'custom_iron');assert.deepEqual(customRuntime.zones.find(zone=>zone.id==='grassland').equipmentDropIds,['custom_iron'],'legacy custom gear IDs remain valid without standard-item references');
const collisionLegacy=structuredClone(legacyEquipment);collisionLegacy.items.push({id:'eclipse_robe',name:'独自のローブ',type:'armor',value:1,icon:'♢',price:1,category:'gear'});const collisionRuntime=withJobs(collisionLegacy,content),collisionId=collisionRuntime.items.find(item=>item.name==='月蝕のローブ')?.id;assert.ok(collisionId&&collisionId!=='eclipse_robe');assert.ok(collisionRuntime.zones.find(zone=>zone.id==='moon_ruins').equipmentDropIds.includes(collisionId));assert.deepEqual(withJobs(collisionRuntime,content),collisionRuntime,'builtin equipment ID collisions remain stable across repeated supplementation');
console.log('PASS: equipment rarity/effects validation, shop/drop gates, legacy fixed gear supplementation and stable references');
console.log('PASS: attack buff schema, target-only stats, physical critical/magic separation, duration/refresh, normalization and snapshot-compatible saves');
