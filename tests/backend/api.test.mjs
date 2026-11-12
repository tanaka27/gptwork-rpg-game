import {test} from 'node:test';import assert from 'node:assert/strict';import {openDatabase} from '../../server/local-db.mjs';import {handleApi} from '../../server/api.mjs';import seed from '../../content/game.json' with {type:'json'};
import AdventurerRules from '../../shared/adventurers.js';
const fixture=()=>({v:2,node:'meadow',lastTown:'home',lv:1,xp:0,hp:80,mp:20,gold:30,weapon:'twig',armor:'cloth',owned:['twig','cloth'],items:{herb:3,ether:1,potion:0},materials:{},zone:0,kills:[0,0,0],cleared:[false,false,false],total:0,turn:1,log:['開始'],enemy:null,journey:null});
function setup(){const DB=openDatabase();const env={DB,OWNER_ID:'owner'};return {DB,call:async(path,method='GET',data,headers={})=>{const response=await handleApi(new Request('https://rpg.test'+path,{method,headers:{'oai-authenticated-user-id':'owner','origin':'https://rpg.test',...headers},...(data?{body:JSON.stringify(data)}:{})}),env);return {status:response.status,body:await response.json()};}};}
test('owner authentication and same-origin writes',async()=>{const app=setup();assert.equal((await app.call('/api/content','GET',null,{'oai-authenticated-user-id':''})).status,401);assert.equal((await app.call('/api/content','GET',null,{'oai-authenticated-user-id':'stranger'})).status,403);assert.equal((await app.call('/api/admin/drafts','POST',{}, {origin:'https://evil.test'})).status,403);app.DB.close();});
test('draft isolation, validation, revision, publish, immutable versions and rollback',async()=>{const app=setup();assert.equal((await app.call('/api/content')).body.id,'bundled');const created=await app.call('/api/admin/drafts','POST',{label:'test'});assert.equal(created.status,201);const id=created.body.id,edited=structuredClone(seed);edited.monsters[0].name='追加した敵';assert.equal((await app.call('/api/admin/versions/'+id,'PUT',{revision:1,data:edited})).status,200);assert.equal((await app.call('/api/admin/versions/'+id,'PUT',{revision:1,data:edited})).status,409);assert.equal((await app.call('/api/content')).body.data.monsters[0].name,seed.monsters[0].name);assert.equal((await app.call('/api/admin/preview?version='+id)).body.data.monsters[0].name,'追加した敵');assert.equal((await app.call('/api/admin/versions/'+id+'/publish','POST',{revision:2})).status,200);assert.equal((await app.call('/api/content')).body.id,id);assert.equal((await app.call('/api/admin/versions/'+id,'PUT',{revision:2,data:edited})).status,409);assert.equal((await app.call('/api/admin/versions/bundled/publish','POST',{revision:0})).status,200);assert.equal((await app.call('/api/content')).body.id,'bundled');app.DB.close();});
test('save import, CAS conflict, backup history and invalid state rejection',async()=>{const app=setup();assert.equal((await app.call('/api/save')).body.revision,0);const save=fixture();assert.equal((await app.call('/api/save','PUT',{revision:0,state:save})).status,200);assert.equal((await app.call('/api/save','PUT',{revision:0,state:save})).status,409);save.gold=99;assert.equal((await app.call('/api/save','PUT',{revision:1,state:save})).body.revision,2);const history=(await app.call('/api/save/history')).body.history;assert.equal(history.length,1);assert.equal((await app.call('/api/save/history/'+history[0].id)).body.state.gold,30);save.gold=-1;assert.equal((await app.call('/api/save','PUT',{revision:2,state:save})).status,422);assert.equal((await app.call('/api/save')).body.state.gold,99);app.DB.close();});
test('per-save NPC state round-trips and protects map nodes referenced only by NPCs',async()=>{
 const app=setup();try{
  const data=structuredClone(seed),outpost={id:'npc_outpost',name:'旅人の野営地',zoneId:'grassland',x:8,y:8,links:['home']};
  data.nodes[0].links.push(outpost.id);data.nodes.push(outpost);
  const created=await app.call('/api/admin/drafts','POST',{data,label:'NPC outpost fixture'});assert.equal(created.status,201);
  assert.equal((await app.call('/api/admin/versions/'+created.body.id+'/publish','POST',{revision:1})).status,200);
  const adventurerState=AdventurerRules.initialState(data.nodes);
  adventurerState.tick=7;adventurerState.explorationProgress=2;adventurerState.locations.adventurer_001=outpost.id;
  const state={...fixture(),adventurerState},saved=await app.call('/api/save','PUT',{revision:0,state});assert.equal(saved.status,200);
  assert.deepEqual((await app.call('/api/save')).body.state.adventurerState,adventurerState,'NPC positions and random progress survive cloud save/restore reads');
  const removed=structuredClone(data);removed.nodes=removed.nodes.filter(node=>node.id!==outpost.id);removed.nodes.find(node=>node.id==='home').links=removed.nodes.find(node=>node.id==='home').links.filter(id=>id!==outpost.id);
  const next=await app.call('/api/admin/drafts','POST',{data:removed,label:'remove NPC-only node'});assert.equal(next.status,201);
  assert.equal((await app.call('/api/admin/versions/'+next.body.id+'/publish','POST',{revision:1})).status,422,'a published map cannot remove a node occupied by an NPC');
  assert.equal((await app.call('/api/save')).body.state.adventurerState.locations.adventurer_001,outpost.id,'rejected publication preserves NPC save state');
 }finally{app.DB.close();}
});
test('legacy and active quest states round-trip through cloud saves while invalid quest states are rejected',async()=>{
 const app=setup();try{
  let revision=0;
  for(const claimed of [false,true]){
   const old={...fixture(),claimed};
   const result=await app.call('/api/save','PUT',{revision,state:old});assert.equal(result.status,200);
   revision=result.body.revision;assert.equal((await app.call('/api/save')).body.state.questState,undefined,'legacy v:2 state stays readable without quest fields');
  }
  const accepted={...fixture(),claimed:false,questState:{active:{id:'apprentice_hunt',acceptedAtTotal:0},completedIds:[]}};
  const saved=await app.call('/api/save','PUT',{revision,state:accepted});assert.equal(saved.status,200);
  const roundTrip=(await app.call('/api/save')).body.state;assert.deepEqual(roundTrip.questState,accepted.questState);
  const invalid={...accepted,questState:{active:{id:'apprentice_hunt',acceptedAtTotal:1},completedIds:['apprentice_hunt']}};
  assert.equal((await app.call('/api/save','PUT',{revision:saved.body.revision,state:invalid})).status,422);
  assert.deepEqual((await app.call('/api/save')).body.state.questState,accepted.questState,'rejected quest state cannot overwrite progress');
 }finally{app.DB.close();}
});
test('publishing cannot invalidate current cloud saves',async()=>{const app=setup();await app.call('/api/save','PUT',{revision:0,state:fixture()});const data=structuredClone(seed);data.items=data.items.filter(e=>e.id!=='twig');const draft=await app.call('/api/admin/drafts','POST',{data});assert.equal(draft.status,201);assert.equal((await app.call('/api/admin/versions/'+draft.body.id+'/publish','POST',{revision:1})).status,422);app.DB.close();});
test('legacy and job-enabled battle snapshots round-trip through cloud saves without changing bundled content',async()=>{
 const app=setup();try{
  const members=[{characterId:'rina',hp:64,mp:24},{characterId:'gald',hp:100,mp:12},{characterId:'noel',hp:68,mp:32}];
  const legacy=structuredClone(seed);legacy.skills=legacy.skills.filter(skill=>!['rina_aimed_shot','rina_comet_arrow','gald_kiai','gald_full_power_slash','noel_prayer_light','noel_holy_light'].includes(skill.id));
  for(const character of legacy.characters)delete character.job;for(const skill of legacy.skills)delete skill.characterId;
  const oldSave={...fixture(),lv:3,enemy:{name:'古いsnapshotの敵',hp:100,max:100},companions:structuredClone(members),battleContent:legacy,buffs:[{characterId:'astel',skillId:'inspire',remainingTurns:3,appliedTurn:1}]};
  assert.equal((await app.call('/api/save','PUT',{state:oldSave,revision:0})).status,200);
  const oldRoundTrip=(await app.call('/api/save')).body.state;assert.equal(oldRoundTrip.battleContent.characters[1].job,undefined);assert.equal(oldRoundTrip.battleContent.skills.some(skill=>skill.id==='gald_kiai'),false);
  const current={...fixture(),lv:3,enemy:{name:'新しいsnapshotの敵',hp:100,max:100},companions:structuredClone(members),battleContent:structuredClone(seed),buffs:[{characterId:'gald',skillId:'gald_kiai',remainingTurns:3,appliedTurn:1}]};
  assert.equal((await app.call('/api/save','PUT',{state:current,revision:1})).status,200);
  const currentRoundTrip=(await app.call('/api/save')).body.state;assert.equal(currentRoundTrip.battleContent.skills.find(skill=>skill.id==='gald_kiai').characterId,'gald');assert.equal(currentRoundTrip.buffs[0].skillId,'gald_kiai');
  assert.equal((await app.call('/api/content')).body.id,'bundled','saving battle snapshots leaves published content untouched');
 }finally{app.DB.close();}
});
test('malformed drafts and stale publication revisions are rejected without activation',async()=>{const app=setup();assert.equal((await app.call('/api/admin/drafts','POST',{data:{schemaVersion:1}})).status,422);const created=await app.call('/api/admin/drafts','POST',{});assert.equal((await app.call('/api/admin/versions/'+created.body.id+'/publish','POST',{revision:99})).status,409);assert.equal((await app.call('/api/content')).body.id,'bundled');app.DB.close();});
test('two writers with the same revision cannot duplicate a save update',async()=>{const app=setup();await app.call('/api/save','PUT',{state:fixture(),revision:0});const results=await Promise.all([app.call('/api/save','PUT',{state:{...fixture(),gold:31},revision:1}),app.call('/api/save','PUT',{state:{...fixture(),gold:32},revision:1})]);assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);assert.equal((await app.call('/api/save')).body.revision,2);assert.equal((await app.call('/api/save/history')).body.history.length,1);app.DB.close();});
test('SQLite data survives closing and reopening the database',async()=>{const fs=await import('node:fs');const os=await import('node:os');const path=await import('node:path');const directory=fs.mkdtempSync(path.join(os.tmpdir(),'rpg-db-')),file=path.join(directory,'save.sqlite');try{let DB=openDatabase(file);await DB.prepare('INSERT INTO saves(owner_id,state,revision,updated_at) VALUES (?,?,1,?)').bind('owner',JSON.stringify(fixture()),new Date().toISOString()).run();DB.close();DB=openDatabase(file);assert.equal(JSON.parse((await DB.prepare('SELECT state FROM saves WHERE owner_id=?').bind('owner').first()).state).gold,30);DB.close();}finally{fs.rmSync(directory,{recursive:true,force:true});}});
test('verified owner email can authorize a site-scoped identity without using an account ID as its key',async()=>{const DB=openDatabase();try{const env={DB,OWNER_EMAIL:'owner@example.test'};const request=new Request('https://rpg.test/api/content',{headers:{'oai-authenticated-user-id':'site-scoped-identity','oai-authenticated-user-email':'owner@example.test'}});assert.equal((await handleApi(request,env)).status,200);const stranger=new Request('https://rpg.test/api/content',{headers:{'oai-authenticated-user-id':'other-site-identity','oai-authenticated-user-email':'stranger@example.test'}});assert.equal((await handleApi(stranger,env)).status,403);}finally{DB.close();}});

test('attack buffs publish as immutable definitions and battle snapshots preserve save compatibility',async()=>{
 const app=setup();try{
  const data=structuredClone(seed),skill=data.skills.find(s=>s.id==='inspire');assert.ok(skill);
  skill.effects[0].multiplier=1.75;
  const created=await app.call('/api/admin/drafts','POST',{data,label:'buff definitions'});assert.equal(created.status,201);
  const id=created.body.id;assert.deepEqual((await app.call('/api/admin/versions/'+id+'/validate','POST',{})).body.errors,[]);
  assert.equal((await app.call('/api/admin/versions/'+id+'/publish','POST',{revision:1})).status,200);
  assert.equal((await app.call('/api/content')).body.data.skills.find(s=>s.id==='inspire').effects[0].multiplier,1.75);
  const save=fixture();save.lv=2;save.enemy={name:'テスト敵',hp:100,max:100};save.battleContent=structuredClone(data);save.buffs=[{characterId:data.rules.party[0],skillId:'inspire',remainingTurns:3,appliedTurn:save.turn}];
  assert.equal((await app.call('/api/save','PUT',{state:save,revision:0})).status,200);
  const next=structuredClone(data);next.skills=next.skills.filter(s=>s.id!=='inspire');
  const nextDraft=await app.call('/api/admin/drafts','POST',{data:next,label:'remove buff for new battles'});assert.equal(nextDraft.status,201);
  assert.equal((await app.call('/api/admin/versions/'+nextDraft.body.id+'/publish','POST',{revision:1})).status,200,'valid snapshot survives publication removing skill');
  assert.equal((await app.call('/api/save','PUT',{state:save,revision:1})).status,200);
  assert.equal((await app.call('/api/admin/versions/'+id,'PUT',{revision:1,data})).status,409,'published buff definition remains immutable');
  const bad=structuredClone(data);bad.skills.find(s=>s.id==='inspire').effects[0].turns=0;
  assert.equal((await app.call('/api/admin/drafts','POST',{data:bad})).status,422);
  save.buffs[0].remainingTurns=4;assert.equal((await app.call('/api/save','PUT',{state:save,revision:2})).status,422);
  assert.equal((await app.call('/api/save')).body.state.buffs[0].remainingTurns,3,'rejected buff cannot overwrite save');
 }finally{app.DB.close();}
});

test('legacy published equipment stays raw while runtime and cloud saves receive compatibility equipment',async()=>{
 const app=setup();try{
  const legacy=structuredClone(seed),builtins=['moonsteel_blade','starward_armor','eclipse_robe','starlight_blade'];
  legacy.items=legacy.items.filter(item=>!builtins.includes(item.id));for(const item of legacy.items.filter(item=>item.category==='gear')){delete item.rarity;delete item.bonusEffects;}
  for(const zone of legacy.zones)delete zone.equipmentDropIds;for(const shop of legacy.shops)shop.itemIds=shop.itemIds.filter(id=>!['moonsteel_blade','starward_armor'].includes(id));
  const created=await app.call('/api/admin/drafts','POST',{data:legacy,label:'old equipment fixture'});assert.equal(created.status,201);
  assert.equal((await app.call('/api/admin/versions/'+created.body.id+'/publish','POST',{revision:1})).status,200);
  const runtime=(await app.call('/api/content')).body.data;
  assert.ok(runtime.items.some(item=>item.id==='moonsteel_blade'&&item.rarity==='uncommon'));
  assert.ok(runtime.items.some(item=>item.id==='eclipse_robe'&&item.rarity==='rare'));
  assert.ok(runtime.items.some(item=>item.id==='starlight_blade'&&item.rarity==='legendary'));
  assert.ok(runtime.shops.find(shop=>shop.nodeId==='luna').itemIds.includes('moonsteel_blade'));
  assert.ok(runtime.zones.find(zone=>zone.id==='volcano').equipmentDropIds.includes('starlight_blade'));
  const raw=(await app.call('/api/admin/versions/'+created.body.id)).body.data,exported=await app.call('/api/admin/export');
  assert.equal(raw.items.some(item=>builtins.includes(item.id)),false,'version API keeps the immutable raw definition');
  assert.equal(raw.items.find(item=>item.id==='twig').rarity,undefined);
  assert.equal(raw.zones[0].equipmentDropIds,undefined);
  assert.equal(exported.body.items.some(item=>builtins.includes(item.id)),false,'export remains the raw public definition');
  const save={...fixture(),weapon:'starlight_blade',owned:['twig','cloth','starlight_blade']};
  assert.equal((await app.call('/api/save','PUT',{state:save,revision:0})).status,200,'runtime-supplemented IDs pass cloud save validation');
  const second=await app.call('/api/admin/drafts','POST',{data:legacy,label:'old compatibility publish'});
  assert.equal((await app.call('/api/admin/versions/'+second.body.id+'/publish','POST',{revision:1})).status,200,'republishing the old raw shape validates against compatibility data');
 }finally{app.DB.close();}
});

test('published old rarity IDs stay raw while runtime, preview, draft copies, and snapshots normalize',async()=>{
 const app=setup();try{
  const legacy=structuredClone(seed),oldIds={common:'normal',uncommon:'rare',rare:'epic',legendary:'legend'},id='old-rarity-published',stamp=new Date().toISOString();
  for(const item of legacy.items.filter(item=>item.category==='gear'))item.rarity=oldIds[item.rarity];
  await app.DB.prepare('INSERT INTO content_versions (id,label,data,status,revision,created_at,updated_at) VALUES (?,?,?,?,?,?,?)').bind(id,'old rarity',JSON.stringify(legacy),'published',1,stamp,stamp).run();
  await app.DB.prepare("INSERT INTO app_settings(key,value) VALUES ('active_content',?)").bind(id).run();
  const runtime=(await app.call('/api/content')).body.data;
  assert.deepEqual(runtime.items.filter(item=>item.category==='gear').map(item=>item.rarity),seed.items.filter(item=>item.category==='gear').map(item=>item.rarity));
  assert.deepEqual((await app.call('/api/admin/versions/'+id+'/validate','POST',{})).body.errors,[],'published legacy definition validates through its compatibility clone');
  const preview=(await app.call('/api/admin/preview?version='+id)).body.data;assert.deepEqual(preview.items.filter(item=>item.category==='gear').map(item=>item.rarity),seed.items.filter(item=>item.category==='gear').map(item=>item.rarity));
  const copied=await app.call('/api/admin/drafts','POST',{sourceId:id,label:'normalized legacy copy'});assert.equal(copied.status,201);const draft=(await app.call('/api/admin/versions/'+copied.body.id)).body.data;assert.deepEqual(draft.items.filter(item=>item.category==='gear').map(item=>item.rarity),seed.items.filter(item=>item.category==='gear').map(item=>item.rarity),'new draft stores canonical rarity IDs');
  const raw=(await app.call('/api/admin/versions/'+id)).body.data,exported=await app.call('/api/admin/export');assert.deepEqual(raw,legacy,'version API does not mutate the published raw row');assert.deepEqual(exported.body,legacy,'export continues to return the raw published definition');
  const snapshot={...fixture(),enemy:{name:'旧レアリティの戦闘',hp:100,max:100,atk:0,def:0,boss:false},battleContent:legacy};
  const saved=await app.call('/api/save','PUT',{state:snapshot,revision:0});assert.equal(saved.status,200,'v:2 save accepts an old battle snapshot through a compatibility clone');assert.equal((await app.call('/api/save')).body.state.battleContent.items.find(item=>item.id==='moonsteel_blade').rarity,'rare','snapshot validation never rewrites the incoming save');
  const invalid=structuredClone(seed);invalid.items.find(item=>item.id==='eclipse_robe').bonusEffects.pop();assert.equal((await app.call('/api/admin/drafts','POST',{data:invalid,label:'strict new rarity'})).status,422,'new rarity definitions remain strictly validated');
 }finally{app.DB.close();}
});
