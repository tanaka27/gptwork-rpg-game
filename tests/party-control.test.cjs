const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
// party.jsの自動進行（scheduleRound）を止めて読み込む。整形の差に左右されないよう正規表現で置換し、見つからなければ失敗させる。
function withoutScheduledRound(source){const pattern=/function scheduleRound\(\)\s*\{\s*return partyRound\(\);?\s*\}/;if(!pattern.test(source))throw new Error('scheduleRound not found in dist/party.js');return source.replace(pattern,'function scheduleRound(){}');}
const data=require('../content/game.json'),rules=require('../shared/rules.js'),content=require('../shared/content.js'),saves=require('../shared/save.js');
function boot(saved){
 const nodes={},storage={};const node=()=>({innerHTML:'',textContent:'',disabled:false,addEventListener(){},querySelectorAll(){return [];},focus(){},classList:{add(){},remove(){},toggle(){}},showModal(){},close(){},append(){}});
 const c={document:{getElementById:id=>nodes[id]??=node(),querySelectorAll:()=>[],addEventListener(){},createElement:node},localStorage:{getItem:()=>saved?JSON.stringify(saved):null,setItem:(k,v)=>storage[k]=v,removeItem(){}},console,setTimeout:fn=>fn(),Math:Object.create(Math)};
 c.Math.random=()=>.5;c.GameData=structuredClone(data);vm.createContext(c);
 for(const file of ['shared/content.js','shared/rules.js','shared/quests.js','shared/adventurers.js','dist/storage.js','dist/combat.js','dist/game.js'])vm.runInContext(fs.readFileSync(file,'utf8'),c);
 vm.runInContext(withoutScheduledRound(fs.readFileSync('dist/party.js','utf8')),c);
 return {run:s=>vm.runInContext(s,c),storage,nodes};
}
const flush=async()=>{for(let i=0;i<20;i++)await Promise.resolve();};
(async()=>{
 const app=boot();assert.deepEqual(Array.from(app.run('allies().map((a,i)=>allyStats(i).maxHP)')),[80,64,100,68]);
 assert.deepEqual(Array.from(app.run('allies().map((a,i)=>allyStats(i).maxMP)')),[20,24,12,32]);
 const old=JSON.parse(app.storage['starlight-rpg-v1']);old.weapon='iron';old.owned.push('iron');old.companions.forEach(c=>{delete c.weapon;delete c.armor;c.hp=200;c.mp=100;});
 const migrated=boot(old);assert.equal(migrated.run('state.companions[0].weapon'),'iron');assert.equal(migrated.run('state.companions[0].hp'),200);assert.equal(migrated.run('state.companions[0].mp'),100);
 migrated.run("actingAlly=1;action('equip:twig')");assert.equal(migrated.run('state.weapon'),'iron');assert.equal(migrated.run('state.companions[0].weapon'),'twig');
 const resumed=boot(JSON.parse(migrated.storage['starlight-rpg-v1']));assert.equal(resumed.run('state.companions[0].weapon'),'twig');
 const legacy=structuredClone(data);legacy.characters.forEach(c=>delete c.stats);assert.equal(rules.stats(old,legacy,1).maxHP,64);assert.equal(rules.stats(old,legacy,3).wisdom,18);
 const reordered=structuredClone(old);reordered.companions.reverse();assert.equal(rules.memberState(reordered,data,1).characterId,'rina');
 for(const mutate of [d=>d.characters[1].stats.baseHP=0,d=>d.characters[1].stats.hpPerLevel=-1,d=>d.characters[1].stats.baseMP=NaN,d=>d.characters[1].stats={bad:3},d=>d.rules.party[1]='astel']){const changed=structuredClone(data);mutate(changed);assert.ok(content.validate(changed).length);}
 assert.deepEqual(saves.validate(old,data),[]);
 for(const mutate of [s=>s.companions[0].weapon='missing',s=>s.companions[0].weapon='cloth',s=>s.companions[0].weapon='star',s=>s.companions[0].characterId='missing',s=>s.companions[0].characterId=s.companions[1].characterId]){const changed=structuredClone(old);mutate(changed);assert.ok(saves.validate(changed,data).length);}
 app.run("state.lv=3;state.mp=0;state.hp=0;allies();state.companions.forEach(c=>{c.hp=1;c.mp=0;});actingAlly=3;state.companions[2].mp=20;useSkill('noel_prayer_light',1)");
 assert.equal(app.run('state.mp'),0);assert.equal(app.run('state.companions[2].mp'),16);assert.equal(app.run('state.companions[0].hp'),60);
 app.run("state.companions[0].hp=1;state.items.potion=1;applyItem('potion',1)");assert.equal(app.run('state.companions[0].hp'),92);
 app.run("state.node='home';state.village=true;state.gold=0;state.companions[0].hp=200;state.companions[0].mp=0;action('rest')");assert.equal(app.run('state.companions[0].hp'),200);assert.equal(app.run('state.companions[0].mp'),17);
 // Real command resolver, no replacement: every living ally waits independently.
 const control=boot();control.run("state.lv=3;state.hp=0;state.mp=0;state.companions.forEach(c=>{c.hp=100;c.mp=20});state.enemy={name:'試験',hp:9999,max:9999,atk:0,def:0,speed:0};state.enemies=[state.enemy];waitForBattleMessage=()=>Promise.resolve()");
 const round=control.run('partyRound()');await flush();assert.equal(control.run('actingAlly'),1);assert.ok(control.run('!!commandResolve'));
 const before=control.run('state.companions[0].mp');assert.equal(control.run("useSkill('rina_aimed_shot',0)"),true);assert.equal(control.run("combat('attack')"),false);await flush();
 assert.equal(control.run('state.companions[0].mp'),before-3);assert.equal(control.run('state.mp'),0);assert.equal(control.run('actingAlly'),3);
 control.run("combat('guard')");await flush();assert.equal(control.run('actingAlly'),2);assert.equal(control.run('state.companions[2].mp'),23);
 control.run("combat('attack')");await flush();assert.equal(control.run('state.turn'),2);assert.equal(control.run('actingAlly'),1);
 control.run("Math.random=()=>0;combat('run')");await round;assert.equal(control.run('state.enemy'),null);
 // Individual guard and defense: deterministic enemy targeting the second member.
 const guard=boot();guard.run("state.companions.forEach((a,i)=>{a.hp=100;a.mp=i===0?100:0;});state.enemy={name:'試験',hp:9999,max:9999,atk:60,def:0,speed:1};state.enemies=[state.enemy];Math.random=()=>.3;waitForBattleMessage=()=>Promise.resolve()");
 await guard.run("executePartyRound(i=>Promise.resolve({kind:i===1?'guard':'attack'}))");
 assert.equal(guard.run('state.companions[0].mp'),100,'guard preserves over-cap legacy MP');
 assert.equal(guard.run('state.companions[0].hp'),100-guard.run('CombatRules.physicalDamage({attack:60,defense:allyStats(1).defense,guard:true})'));
 const invalid=boot();invalid.run("state.lv=3;state.enemy={name:'敵0',hp:9999,max:9999,atk:0,def:0,speed:0};state.enemies=[state.enemy,{name:'敵1',hp:9999,max:9999,atk:0,def:0,speed:0}];");
 const invalidMP=invalid.run('state.companions[0].mp');
 const staged=invalid.run("executePartyRound(i=>Promise.resolve(i===1?{kind:'skill',skillId:'flame',skillTargetIndex:0}:{kind:'attack'}))");await flush();
 invalid.run('state.enemies[0].hp=0');invalid.nodes.fieldMessage.onclick();await flush();
 assert.equal(invalid.run('state.companions[0].mp'),invalidMP,'invalidated damage target spends no MP');
 for(let i=0;i<50&&invalid.run('busy');i++){invalid.nodes.fieldMessage.onclick();await flush();}await staged;
 console.log('PASS: independent stats/equipment, old definitions/saves, non-destructive migration, validation, individual recovery, real all-ally commands, fallen hero, MP isolation, guard and escape');
})().catch(e=>{console.error(e);process.exitCode=1;});
