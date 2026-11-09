const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = fs.readFileSync('dist/game.js', 'utf8');
function boot(saved = null, party = false, manualMessages = false) {
  const nodes = {}, storage = {};
  const node = () => ({innerHTML:'', textContent:'', disabled:false,
    addEventListener(){}, focus(){}, classList:{add(){}, remove(){}, toggle(){}}, showModal(){}, close(){}, append(child){this.children??=[];this.children.push(child)}, scrollIntoView(){}});
  const context = {
    document:{getElementById:id=>nodes[id]??=node(), querySelectorAll:()=>[], addEventListener(){}, createElement:node},
    localStorage:{getItem:()=>saved, setItem:(key,value)=>storage[key]=value, removeItem:key=>delete storage[key]},
    console, setTimeout:fn=>{fn();return 1}, Math:Object.create(Math)
  };
  context.Math.random = () => .5;
  vm.createContext(context);
  context.GameData=JSON.parse(fs.readFileSync('content/game.json','utf8'));
  for(const file of ['shared/content.js','shared/rules.js','dist/storage.js'])vm.runInContext(fs.readFileSync(file,'utf8'),context);
  vm.runInContext(fs.readFileSync('dist/combat.js','utf8'),context);
  vm.runInContext(source, context);
  // Existing progression tests traverse real, uneventful three-step routes.
  vm.runInContext(`function walkTo(id){if(!moveTo(id))return false;const previous=Math.random;Math.random=()=>.99;try{for(let i=0;i<3;i++)advanceTravel();}finally{Math.random=previous;}return !state.journey;}`,context);
  if(party) {
    // Engine regressions supply a command at the hero's slot; controller timing is tested separately.
    vm.runInContext(fs.readFileSync('dist/party.js','utf8').replace('function scheduleRound(){return partyRound();}', 'function scheduleRound(){}'),context);
    vm.runInContext(`commandResolve=()=>{};partyRound=function(kind,skillId,itemId,skillTargetIndex=selectedEnemy){if(busy||!state.enemy)return;return executePartyRound(()=>Promise.resolve({kind,skillId,itemId,skillTargetIndex}));};submitCommand=(...args)=>partyRound(...args);`,context);
  }
  if(party&&!manualMessages)vm.runInContext('waitForBattleMessage=()=>Promise.resolve()',context);
  return {run:code=>vm.runInContext(code,context), nodes, storage};
}
(async () => {
  // Attack buffs use the actual round engine, not a duplicate damage formula.
  const buffed=boot(null,true);
  buffed.run("state.lv=7;state.hp=maxhp();state.mp=maxmp();allies();startBattle();state.enemies.forEach(e=>{e.hp=10000;e.max=10000;e.atk=0;e.def=0;});render(false)");
  const baseAttack=buffed.run('attack()'),buffMP=buffed.run('state.mp');
  await buffed.run("useSkill('inspire',3)");
  assert.equal(buffed.run('state.mp'),buffMP-4);
  assert.equal(buffed.run('state.buffs[0].remainingTurns'),3,'application round does not decrement');
  assert.equal(buffed.run('allyAttack(3)'),Math.floor(baseAttack*1.5));
  assert.equal(buffed.run('allyAttack(0)'),baseAttack);
  assert.ok(buffed.nodes.partyStatus.innerHTML.includes('buff-icon'));
  buffed.run('selectedCharacter=3;renderCharacterScreen()');
  assert.ok(buffed.nodes.partyDetails.innerHTML.includes('残り3ターン'));
  await buffed.run("partyRound('guard')");assert.equal(buffed.run('state.buffs[0].remainingTurns'),2);
  await buffed.run("partyRound('skill','inspire',null,3)");assert.equal(buffed.run('state.buffs[0].remainingTurns'),3,'recast refreshes, does not stack');
  assert.equal(buffed.run('state.buffs.length'),1);
  const checkpoint=buffed.storage['starlight-rpg-v1'];
  const buffResumed=boot(checkpoint,true);assert.equal(buffResumed.run('state.buffs[0].remainingTurns'),3);assert.equal(buffResumed.run('allyAttack(3)'),Math.floor(baseAttack*1.5));
  for(const remaining of [2,1,0]){await buffed.run("partyRound('guard')");assert.equal(buffed.run('state.buffs[0]?.remainingTurns||0'),remaining);}
  assert.equal(buffed.run('allyAttack(3)'),baseAttack);assert.ok(buffed.run("state.log.some(t=>t.includes('効果が切れた'))"));
  buffed.run("GameRules.applyAttackBuff(state,GameData,3,skillList.find(s=>s.id==='inspire'));setAllyHP(3,0)");assert.equal(buffed.run('state.buffs.length'),0,'death removes buffs');
  buffed.run("GameRules.applyAttackBuff(state,GameData,0,skillList.find(s=>s.id==='inspire'));state.enemies.forEach((e,i)=>e.hp=i?0:1)");await buffed.run("partyRound('attack')");assert.equal(buffed.run('state.buffs.length'),0,'victory clears buffs');
  const outsideMP=buffed.run('state.mp');assert.equal(buffed.run("useSkill('inspire',0)"),false);assert.equal(buffed.run('state.mp'),outsideMP);
  const compareRound=async(boost,id,index=0)=>{const app=boot(null,true);app.run("state.lv=7;state.hp=maxhp();state.mp=maxmp();allies();startBattle();state.enemies.forEach(e=>{e.hp=10000;e.max=10000;e.atk=0;e.def=0;});render(false)");if(boost)app.run(`GameRules.applyAttackBuff(state,GameData,${index},skillList.find(s=>s.id==='inspire'))`);await app.run(id?`partyRound('skill','${id}',null,0)`:'partyRound(\'attack\')');return app.run('state.enemies.reduce((sum,e)=>sum+10000-e.hp,0)');};
  assert.ok(await compareRound(true)>await compareRound(false),'hero normal attack uses effective attack');
  assert.ok(await compareRound(true,null,3)>await compareRound(false),'companion auto attack uses its own effective attack');
  assert.ok(await compareRound(true,'slash')>await compareRound(false,'slash'),'physical skill uses effective attack');
  assert.equal(await compareRound(true,'flame'),await compareRound(false,'flame'),'magic ignores attack buff');
  for(const outcome of ['escape','defeat']){
   const exit=boot(null,true);exit.run("state.lv=7;state.hp=maxhp();state.mp=maxmp();allies();startBattle();state.enemies.forEach(e=>{e.hp=10000;e.max=10000;e.atk=0;});GameRules.applyAttackBuff(state,GameData,0,skillList.find(s=>s.id==='inspire'))");
   if(outcome==='escape'){exit.run('Math.random=()=>0');await exit.run("partyRound('run')");}
   else{exit.run('state.hp=1;state.companions.forEach(a=>a.hp=0);state.enemies.forEach(e=>e.atk=100000)');await exit.run("partyRound('guard')");}
   assert.equal(exit.run('state.enemy'),null);assert.equal(exit.run('state.buffs.length'),0,outcome+' clears buffs');
  }
  const invalidBuff=boot(null,true,true);
  invalidBuff.run("state.lv=7;state.hp=maxhp();state.mp=maxmp();allies();partySpeeds[0]=999;startBattle();state.enemies.forEach(e=>{e.hp=10000;e.max=10000;e.atk=0;});render(false)");
  const invalidMP=invalidBuff.run('state.mp'),invalidRound=invalidBuff.run("partyRound('skill','inspire',null,1)");
  for(let i=0;i<10;i++)await Promise.resolve();
  assert.equal(invalidBuff.run('state.buffs.length'),0);assert.equal(invalidBuff.run('state.mp'),invalidMP);
  invalidBuff.run('setAllyHP(1,0)');invalidBuff.nodes.fieldMessage.onclick();
  for(let i=0;i<10;i++)await Promise.resolve();
  assert.equal(invalidBuff.run('state.buffs.length'),0,'death after announcement prevents buff');assert.equal(invalidBuff.run('state.mp'),invalidMP,'invalid target spends no MP');
  for(let i=0;i<80&&invalidBuff.run('busy');i++){invalidBuff.nodes.fieldMessage.onclick();for(let j=0;j<6;j++)await Promise.resolve();}
  await invalidRound;
  const learnBuff=boot();learnBuff.run("state.xp=threshold()-1;startBattle();state.enemy.xp=1;win()");assert.ok(learnBuff.run("state.log.some(t=>t.includes('新スキル「鼓舞」'))"));assert.ok(learnBuff.run("state.log.some(t=>t.includes('新スキル「火花の魔法」'))"));
  console.log('PASS: buff skill rounds, target attack, display, refresh, expiry, death/victory, save reload and physical/magic integration');

  const reader=boot(null,true,true);
  reader.run("startBattle();state.enemies.forEach(e=>{e.hp=1000;e.max=1000;e.atk=0;});render()");
  const beforeRound=reader.storage['starlight-rpg-v1'];
  const round=reader.run("partyRound('attack')");
  const flush=async()=>{for(let i=0;i<5;i++)await Promise.resolve();};
  await flush();
  const first=reader.nodes.latestLog.textContent;
  assert.equal(reader.run('state.lastRoundOrder.length'),1);
  await flush();
  assert.equal(reader.nodes.latestLog.textContent,first,'no automatic advance');
  assert.equal(reader.run('busy'),true);
  assert.equal(reader.nodes.messageNext.hidden,false);
  await reader.run("partyRound('attack')");
  reader.run('render()');
  assert.equal(reader.storage['starlight-rpg-v1'],beforeRound,'incomplete round is not saved');
  reader.nodes.fieldMessage.onclick();reader.nodes.fieldMessage.onclick();
  await flush();
  assert.equal(reader.run('state.lastRoundOrder.length'),1,'double input resolves only the current announcement');
  assert.equal(reader.run('state.turn'),1);
  reader.nodes.fieldMessage.onkeydown({key:'Enter',repeat:true,preventDefault(){}});
  await flush();
  assert.equal(reader.run('state.lastRoundOrder.length'),1,'held key does not skip result messages');
  reader.nodes.fieldMessage.onkeydown({key:' ',repeat:false,preventDefault(){}});
  await flush();
  assert.equal(reader.run('state.lastRoundOrder.length'),2,'keyboard advances to the next announcement');
  for(let i=0;i<30&&reader.run('busy');i++){reader.nodes.fieldMessage.onclick();await flush();}
  await round;
  assert.equal(reader.run('state.turn'),2);
  assert.equal(reader.run('busy'),false);
  assert.equal(reader.nodes.messageNext.hidden,true);
  const victor=boot(null,true,true);
  victor.run('startBattle();state.lv=30;state.enemies.forEach(e=>{e.hp=1;e.def=0;});Math.random=()=>.5');
  const won=victor.run("partyRound('attack')");
  await flush();let rewards=0;
  for(let i=0;i<60&&victor.run('busy');i++){
    if(victor.nodes.latestLog.textContent.includes('EXP')){rewards++;assert.equal(victor.run('state.total'),rewards,'later enemies rewards are not applied early');}
    victor.nodes.fieldMessage.onclick();await flush();
  }
  await won;
  assert.equal(rewards,4,'all four enemies rewards are shown separately');
  assert.equal(victor.run('state.total'),4);
  assert.equal(victor.run('state.enemy'),null);
  console.log('PASS: battle click wait, single advance, keyboard, busy/save guards and individual victory messages');

  // Every actor must stop before applying damage and again before the next actor.
  const staged=boot(null,true,true);
  staged.run("startBattle();state.enemies.forEach((e,i)=>{e.name='敵'+i;e.hp=1000;e.max=1000;e.atk=20;e.def=0;});render()");
  const hpState=app=>app.run('JSON.stringify({hp:state.hp,mp:state.mp,allies:state.companions,enemies:state.enemies.map(e=>e.hp),turn:state.turn})');
  const hpView=app=>JSON.stringify({allies:app.nodes.partyStatus.innerHTML.match(/<div class="meter-head"[^]*?<\/div><div class="bar[^]*?<\/div>/g),bars:app.nodes.enemy.innerHTML.match(/<span class="enemy-hp bar"[^]*?<\/span>/g)});
  const order=JSON.parse(staged.run('JSON.stringify(roundOrder())'));
  let beforeHP=hpState(staged),beforeView=hpView(staged);
  const stagedRound=staged.run("partyRound('attack')");
  for(let i=0;i<order.length;i++){
    await flush();
    assert.equal(staged.nodes.latestLog.textContent,order[i].name+'の攻撃！');
    assert.equal(hpState(staged),beforeHP,'announcement does not apply damage for '+order[i].name);
    assert.equal(hpView(staged),beforeView,'HP bars remain unchanged until attack is confirmed');
    staged.run('render(false)');await flush();
    assert.equal(hpState(staged),beforeHP,'rendering and waiting cannot apply damage');
    staged.nodes.fieldMessage.onclick();await flush();
    assert.notEqual(hpState(staged),beforeHP,'only confirmed actor applies damage');
    assert.equal(staged.run('state.lastRoundOrder.length'),i+1,'next actor has not started');
    beforeHP=hpState(staged);beforeView=hpView(staged);
    await flush();
    assert.equal(hpState(staged),beforeHP,'result wait blocks subsequent damage');
    assert.equal(hpView(staged),beforeView,'result wait blocks subsequent HP bar changes');
    staged.nodes.fieldMessage.onclick();
  }
  await stagedRound;
  assert.equal(staged.run('state.turn'),2);
  for(const [kind,command,prepare] of [
    ['skill',"partyRound('skill','heal',null,1)",'state.lv=3;state.mp=maxmp();state.companions[0].hp=1'],
    ['item',"partyRound('item',null,'herb')",'state.hp=1'],
    ['guard',"partyRound('guard')",'state.mp=0'],
  ]){
    const app=boot(null,true,true);
    app.run(prepare+";startBattle();state.enemies.forEach(e=>{e.hp=1000;e.max=1000;e.atk=0;});render()");
    const pending=app.run(command);await flush();
    for(let i=0;i<20&&!app.nodes.latestLog.textContent.startsWith('アステル');i++){app.nodes.fieldMessage.onclick();await flush();}
    const hp=hpState(app),items=app.run('state.items.herb');
    if(kind==='skill'){assert.equal(app.run('state.mp'),28);assert.equal(app.run('state.companions[0].hp'),1);}
    if(kind==='item')assert.equal(app.run('state.hp'),1);
    if(kind==='guard')assert.equal(app.run('state.mp'),0);
    await flush();assert.equal(hpState(app),hp,'action announcement preserves HP/MP');
    assert.equal(app.run('state.items.herb'),items,'items are not spent before confirmation');
    app.nodes.fieldMessage.onclick();await flush();
    if(kind==='skill'){assert.equal(app.run('state.mp'),23);assert.equal(app.run('state.companions[0].hp'),53);}
    if(kind==='item'){assert.equal(app.run('state.hp'),46);assert.equal(app.run('state.items.herb'),items-1);}
    if(kind==='guard')assert.equal(app.run('state.mp'),3);
    for(let i=0;i<60&&app.run('busy');i++){app.nodes.fieldMessage.onclick();await flush();}
    await pending;
  }
  console.log('PASS: all eight actors defer HP/MP changes until announcement confirmation, hold results until next click, and stage skill/item/guard effects');

  const healingTargets=boot(null,true);
  healingTargets.run('state.lv=3;state.hp=maxhp();state.mp=maxmp();state.companions[0].hp=1;state.companions[1].hp=0;render()');
  healingTargets.run("action('skills')");
  assert.equal(healingTargets.nodes.actions.hidden,true);
  assert.ok(healingTargets.nodes.skillMenu.innerHTML.includes('skill:heal'));
  healingTargets.run("action('skill-back')");
  assert.equal(healingTargets.nodes.actions.hidden,false);
  const beforeTargetChoice=healingTargets.storage['starlight-rpg-v1'];
  healingTargets.run("useSkill('heal')");
  assert.equal(healingTargets.run('pendingSkill.id'),'heal');
  assert.ok(healingTargets.nodes.partyStatus.innerHTML.includes('data-ally-target="1"'));
  assert.ok(healingTargets.nodes.skillMenu.innerHTML.includes('skillDetail'));
  assert.equal(healingTargets.nodes.actions.hidden,true);
  assert.equal(healingTargets.storage['starlight-rpg-v1'],beforeTargetChoice,'choosing a skill does not consume anything');
  healingTargets.run("action('cancel-skill')");
  assert.equal(healingTargets.run('pendingSkill'),null);
  assert.equal(healingTargets.nodes.actions.hidden,false);
  assert.equal(healingTargets.storage['starlight-rpg-v1'],beforeTargetChoice,'cancel preserves HP, MP and turn');
  healingTargets.run("useSkill('heal');action('cast:heal:2')");
  assert.equal(healingTargets.run('state.companions[1].hp'),0,'healing cannot revive');
  assert.equal(healingTargets.run('state.mp'),28,'invalid cast consumes no MP');
  healingTargets.run("action('cast:heal:0')");
  assert.equal(healingTargets.run('state.mp'),28,'full HP cannot consume MP');
  healingTargets.run("action('cast:heal:1')");
  assert.equal(healingTargets.run('state.companions[0].hp'),53,'chosen companion receives wisdom-scaled healing');
  assert.equal(healingTargets.run('state.hp'),114,'caster HP remains unchanged');
  assert.equal(healingTargets.run('state.mp'),23,'caster pays MP exactly once');
  assert.equal(healingTargets.run('state.turn'),1,'field healing does not consume a battle turn');
  for(const index of [-1,4,1.5,NaN]){
    assert.equal(healingTargets.run(`useSkill('heal',${index})`),false,'invalid ally index');
  }
  healingTargets.run("state.node='home';state.village=true;state.companions[0].hp=maxhp()-1;useSkill('heal',1)");
  assert.equal(healingTargets.run('state.companions[0].hp'),114,'town healing caps at maximum HP');
  healingTargets.run("moveTo('meadow');state.companions[0].hp=1;useSkill('heal',1)");
  assert.equal(healingTargets.run('state.journey.step'),0,'road healing does not advance the journey');
  assert.equal(healingTargets.run('state.companions[0].hp'),53);
  const healedSave=boot(healingTargets.storage['starlight-rpg-v1'],true);
  assert.equal(healedSave.run('state.companions[0].hp'),53,'target HP persists');
  assert.equal(healedSave.run('pendingSkill'),null,'selection UI is not saved');
  const setupSkillBattle=app=>app.run("state.lv=7;state.hp=maxhp();state.mp=maxmp();startBattle();state.enemies.forEach((e,i)=>{e.name='敵'+i;e.hp=10000;e.max=10000;e.atk=0;e.def=0;});render()");
  for(const id of ['flame','slash','nova']){
    const targeted=boot(null,true);setupSkillBattle(targeted);
    targeted.run(`useSkill('${id}')`);
    assert.ok(targeted.nodes.enemy.innerHTML.includes('data-target="3"'));
    assert.ok(targeted.nodes.skillMenu.innerHTML.includes('skillDetail'));
    assert.equal(targeted.run('state.turn'),1);
    const cost=targeted.run(`skillList.find(s=>s.id==='${id}').cost`);
    const casting=targeted.run(`action('cast:${id}:2')`);
    assert.equal(targeted.run("castPendingSkill(2,'enemy')"),false,'one target click cannot cast twice');
    await casting;
    assert.ok(targeted.run(`state.log.some(t=>t.includes('の'+skillList.find(s=>s.id==='${id}').name+'！ 敵2に'))`),'attack skill hits selected enemy');
    assert.equal(targeted.run('state.enemies[0].hp'),10000,'unselected enemies remain unharmed');
    assert.equal(targeted.run('state.mp'),44-cost);
    assert.equal(targeted.run('state.turn'),2,'confirmed cast advances one round');
    assert.equal(targeted.run(`useSkill('${id}',99)`),false);
  }
  const battleHeal=boot(null,true);setupSkillBattle(battleHeal);
  battleHeal.run('state.companions[0].hp=1');
  await battleHeal.run("useSkill('heal',1)");
  assert.equal(battleHeal.run('state.companions[0].hp'),77,'battle healing targets the chosen companion');
  assert.equal(battleHeal.run('state.hp'),182);
  assert.equal(battleHeal.run('state.mp'),39);
  assert.equal(battleHeal.run('state.turn'),2);
  const lostTarget=boot(null,true);setupSkillBattle(lostTarget);
  lostTarget.run('state.companions[0].hp=1;state.enemies[0].speed=100;state.enemies[0].atk=100;Math.random=()=>.3');
  await lostTarget.run("useSkill('heal',1)");
  assert.equal(lostTarget.run('state.companions[0].hp'),0,'target can fall before caster acts');
  assert.equal(lostTarget.run('state.mp'),44,'failed healing during a round consumes no MP');
  const meterCheck=boot(null,true);
  assert.ok(meterCheck.run("enemyHPMeter({name:'試験',hp:5,max:10})").includes('width:50%'));
  assert.ok(meterCheck.run("enemyHPMeter({name:'試験',hp:-1,max:10})").includes('width:0%'));
  const fallbackTarget=boot(null,true);setupSkillBattle(fallbackTarget);
  fallbackTarget.run('state.enemies[2].hp=1');
  await fallbackTarget.run("useSkill('flame',2)");
  assert.ok(fallbackTarget.run("state.log.some(t=>t.includes('の火花の魔法！ 敵0に'))"),'attack retargets if a faster companion defeats chosen enemy');
  assert.equal(fallbackTarget.run('selectedEnemy'),0,'marker follows living target after selected enemy is defeated');
  const unavailable=boot(null,true);setupSkillBattle(unavailable);
  unavailable.run('state.mp=0');
  assert.equal(unavailable.run("useSkill('heal')"),false);
  unavailable.run('state.mp=maxmp();state.hp=0');
  assert.equal(unavailable.run("useSkill('flame')"),false,'fallen caster cannot choose a spell');
  unavailable.run('state.hp=maxhp();busy=true');
  assert.equal(unavailable.run("useSkill('flame')"),false,'busy state blocks selection');
  unavailable.run('busy=false;state.lv=1');
  assert.equal(unavailable.run("useSkill('flame')"),false,'locked skill cannot open selection');
  const skillNavigation=boot(null,true);setupSkillBattle(skillNavigation);
  skillNavigation.run("useSkill('flame');showScreen('map')");
  assert.equal(skillNavigation.run('pendingSkill'),null,'screen changes cancel target selection');
  skillNavigation.run("showScreen('adventure')");
  assert.equal(skillNavigation.nodes.actions.hidden,false,'returning to adventure restores commands');
  skillNavigation.run("useSkill('flame');resetAdventure()");
  assert.equal(skillNavigation.run('skillMenuMode'),'commands','reset clears skill menu');
  assert.equal(skillNavigation.run('pendingSkill'),null);
  console.log('PASS: skill target selection/cancel, enemy targeting for all attack skills, ally healing in battle/town/road, target validity and death-before-cast, MP/turn guards and persistence');
  // Travel must gate arrival, town services and encounters, including after reload.
  const travel=boot(null,true);
  assert.equal(travel.run("moveTo('home')"),true);
  assert.equal(travel.run('state.node'),'meadow','departure does not teleport');
  assert.equal(travel.run('state.village'),false);
  assert.equal(travel.run("moveTo('grove')"),false,'cannot replace a route in progress');
  assert.equal(travel.run('state.journey.step'),0);
  assert.ok(travel.nodes.actions.innerHTML.includes('travel-next'));
  assert.ok(travel.nodes.travelProgress.textContent.includes('0 / 3'));
  travel.run("action('explore');action('boss')");
  assert.equal(travel.run('state.enemy'),null,'exploration and boss commands cannot bypass travel');
  travel.run('Math.random=()=>.99;advanceTravel()');
  assert.equal(travel.run('state.journey.step'),1);
  assert.equal(travel.run('Object.keys(state.materials).length'),0,'uneventful route awards no materials');
  const resumedTravel=boot(travel.storage['starlight-rpg-v1'],true);
  assert.equal(resumedTravel.run('state.journey.step'),1);
  resumedTravel.run('Math.random=()=>.99;advanceTravel()');
  assert.equal(resumedTravel.run('state.node'),'meadow','two steps do not arrive');
  resumedTravel.run('advanceTravel()');
  assert.equal(resumedTravel.run('state.node'),'home');
  assert.equal(resumedTravel.run('state.journey'),null);
  assert.equal(resumedTravel.run('state.village'),true);
  assert.equal(resumedTravel.run('state.lastTown'),'home');
  resumedTravel.run("state.hp=35;state.companions[0].hp=7;moveTo('meadow');action('rest');action('buy:herb')");
  assert.equal(resumedTravel.run('state.hp'),35,'cannot rest while leaving a town');
  assert.equal(resumedTravel.run('state.companions[0].hp'),7,'invalid rest cannot heal companions');
  assert.equal(resumedTravel.run('state.items.herb'),3,'cannot buy on a road');
  assert.equal(resumedTravel.run('currentShopStock().length'),0);
  assert.equal(resumedTravel.run('returnFromTravel()'),true);
  assert.equal(resumedTravel.run('state.node'),'home');
  assert.equal(resumedTravel.run('state.hp'),35,'returning does not recover HP');
  for(const [roll,event] of [[0,'battle'],[.2999,'battle'],[.3,'material'],[.5499,'material'],[.55,'nothing'],[.999,'nothing']]){
    const route=boot(null,true);
    route.run(`moveTo('home');Math.random=()=>${roll};advanceTravel()`);
    assert.equal(route.run('!!state.enemy'),event==='battle','event boundary '+roll);
    assert.equal(route.run('Object.values(state.materials).reduce((a,b)=>a+b,0)'),event==='material'?1:0);
  }
  const roadBattle=boot(null,true);
  roadBattle.run("moveTo('home');Math.random=()=>.99;advanceTravel();advanceTravel();Math.random=()=>0;advanceTravel()");
  assert.equal(roadBattle.run('state.journey.step'),3);
  assert.equal(roadBattle.run('state.node'),'meadow','last-step battle delays arrival');
  assert.equal(roadBattle.run('battleEnemies().length'),4);
  const battleSave=roadBattle.storage['starlight-rpg-v1'];
  assert.equal(roadBattle.run('advanceTravel()'),false,'no progress while in combat');
  assert.equal(roadBattle.run('returnFromTravel()'),false,'no retreat to source while in combat');
  const escapeRoad=boot(battleSave,true);
  await escapeRoad.run("Math.random=()=>0;combat('run')");
  assert.equal(escapeRoad.run('state.node'),'home','escape resolves final step');
  assert.equal(escapeRoad.run('state.journey'),null);
  const winningRoad=boot(battleSave,true);
  winningRoad.run('state.enemies.forEach(e=>{e.hp=1;e.atk=0;})');
  await winningRoad.run("combat('attack')");
  assert.equal(winningRoad.run('state.node'),'home','victory resolves final step');
  assert.equal(winningRoad.run('state.total'),4,'arrival does not duplicate enemy rewards');
  const losingRoad=boot(battleSave,true);
  losingRoad.run('state.enemies.forEach(e=>{e.atk=1000;e.speed=100});state.hp=1;state.companions.forEach(a=>a.hp=1)');
  await losingRoad.run("combat('guard')");
  assert.equal(losingRoad.run('state.journey'),null,'defeat cancels the journey');
  assert.equal(losingRoad.run('state.node'),'home');
  const firstStepBattle=boot(null,true);
  firstStepBattle.run("moveTo('home');Math.random=()=>0;advanceTravel()");
  await firstStepBattle.run("combat('run')");
  firstStepBattle.run('advanceTravel()');
  assert.equal(firstStepBattle.run('state.enemy'),null,'at most one encounter per journey');
  assert.equal(firstStepBattle.run('state.journey.step'),2);
  assert.equal(boot(firstStepBattle.storage['starlight-rpg-v1'],true).run('state.journey.fought'),true,'encounter cap survives reload');
  const crossArea=boot(null,true);
  crossArea.run("state.node='crossing';state.cleared[0]=true;moveTo('luna');Math.random=()=>.3;advanceTravel()");
  assert.equal(crossArea.run('state.zone'),1);
  assert.equal(crossArea.run('state.materials.dust'),1,'materials follow road area');
  const crossResumed=boot(crossArea.storage['starlight-rpg-v1'],true);
  assert.equal(crossResumed.run('state.zone'),1,'road area survives load');
  assert.equal(crossResumed.run('state.village'),false);
  crossResumed.run('returnFromTravel()');
  assert.equal(crossResumed.run('state.zone'),0,'return restores source area');
  const invalidJourney=JSON.parse(battleSave);invalidJourney.journey.to='dragon';invalidJourney.enemy=null;invalidJourney.enemies=[];
  assert.equal(boot(JSON.stringify(invalidJourney),true).run('state.journey'),null,'invalid saved routes cannot teleport');
  const busyTravel=boot(null,true);busyTravel.run("moveTo('home');busy=true");
  assert.equal(busyTravel.run('advanceTravel()'),false);
  assert.equal(busyTravel.run('returnFromTravel()'),false);
  const resetTravel=boot(travel.storage['starlight-rpg-v1'],true);
  resetTravel.run('resetAdventure()');
  assert.equal(resetTravel.run('state.journey'),null,'reset removes route state');
  assert.equal(resetTravel.storage['starlight-rpg-v1'],undefined,'route reset does not recreate save');
  console.log('PASS: three-step routes, all event boundaries, road area, town-service guards, retreat, combat win/escape/defeat, save/reload and invalid-route migration');
  const party = boot(null,true);
  party.run('startBattle()');
  assert.equal(party.run('allies().length'),4);
  assert.equal(party.run('battleEnemies().length'),4);
  assert.equal(party.run('roundOrder()[0].name'),'リナ');
  await party.run("combat('guard')");
  assert.equal(party.run('state.turn'),2);
  assert.equal(party.run('state.lastRoundOrder.length'),8);
  const partyResumed=boot(party.storage['starlight-rpg-v1'],true);
  assert.equal(partyResumed.run('battleEnemies().length'),4);
  party.run('state.hp=0;state.companions[0].hp=0');
  await party.run("combat('attack')");
  assert.equal(party.run("state.lastRoundOrder.includes('アステル')"),false);
  assert.equal(party.run("state.lastRoundOrder.includes('リナ')"),false);
  party.run('state.enemies.forEach(e=>{e.hp=1;e.atk=0;});state.hp=80;state.companions.forEach(a=>a.hp=80)');
  await party.run("combat('attack')");
  assert.equal(party.run('state.enemy'),null);
  assert.equal(party.run('state.total'),4,'rewards once for every defeated enemy');
  const defeat=boot(null,true);defeat.run('startBattle();state.enemies.forEach(e=>{e.atk=1000;e.speed=100});state.hp=1;state.companions.forEach(a=>a.hp=1)');
  await defeat.run("combat('attack')");
  assert.equal(defeat.run('state.node'),'home');
  assert.equal(defeat.run('allies().every(a=>a.hp>0)'),true);
  const app = boot();
  assert.equal(app.run('mapNodes.length'),12);
  assert.equal(app.run('mapNodes.filter(n=>n.town).length'),3);
  assert.equal(app.run('new Set(bestiary.flat().map(e=>e.name)).size'),12);
  assert.equal(app.run('mapNodes.every(a=>a.links.every(id=>nodeById(id)?.links.includes(a.id)))'),true);
  assert.equal(app.run("walkTo('forge')"),false,'cannot teleport');
  assert.equal(app.run("walkTo('crossing')"),true);
  assert.equal(app.run("walkTo('luna')"),false,'progression gate');
  app.run('state.kills[0]=4;startBattle(true)');
  assert.equal(app.run("walkTo('meadow')"),false,'movement blocked in battle');
  await app.run("(async()=>{state.enemy.hp=1;await combat('attack')})()");
  assert.equal(app.run('state.cleared[0]'),true);
  assert.equal(app.run("walkTo('luna')"),true);
  assert.equal(app.run('state.village'),true);
  app.run("state.gold=500;action('buy:iron');action('equip:iron');state.hp=1;action('rest')");
  assert.equal(app.run('state.weapon'),'iron');
  assert.equal(app.run('state.hp===maxhp()'),true);
  app.run("walkTo('ruins');startBattle()");
  assert.equal(app.run('state.enemy.name'),'遺跡の歩哨');
  await app.run("(async()=>{state.hp=1;await combat('guard')})()");
  assert.equal(app.run('state.node'),'luna','rescue at most recently visited town');
  assert.equal(app.run('state.hp===maxhp()'),true);
  app.run("walkTo('ruins');state.kills[1]=4;startBattle(true);state.xp=100");
  assert.equal(app.run('state.enemy'),null);
  assert.equal(app.run('state.cleared[1]'),false,'boss cannot spawn away from boss node');
  app.run("walkTo('altar');startBattle(true);state.enemy.hp=1");
  await app.run("combat('attack')");
  assert.equal(app.run('state.cleared[1]'),true);
  assert.equal(app.run('state.lv>1'),true);
  assert.equal(app.run("walkTo('forge')"),true);
  app.run("walkTo('ash');walkTo('crater');walkTo('dragon');state.kills[2]=4;startBattle(true);state.enemy.hp=1");
  await app.run("combat('attack')");
  assert.equal(app.run('state.cleared.every(Boolean)'),true,'all areas reachable and completable');
  const screens = boot();
  screens.run("action('routes')");
  assert.equal(screens.nodes['screen-map'].hidden,false,'travel opens map screen');
  assert.equal(screens.nodes['screen-adventure'].hidden,true);
  screens.run("walkTo('home');action('shop')");
  assert.equal(screens.nodes['screen-adventure'].hidden,false,'shop stays on the adventure screen');
  assert.equal(screens.nodes.shopMenu.hidden,false);
  assert.equal(screens.nodes['screen-bag'].hidden,true,'shop does not open the bag');
  screens.run("walkTo('meadow');startBattle();action('items');Math.random=()=>0;combat('run')");
  assert.equal(screens.run('state.enemy'),null);
  assert.equal(screens.nodes.subactions.innerHTML,'','successful escape clears battle menu');
  screens.run("tab='materials';renderInventory()");
  assert.ok(!screens.nodes.inventory.innerHTML.includes('55.0000'),'probabilities display clean percentages');
  const townHeading=boot(null,true);
  for(const [id,name] of [['home','はじまりの村'],['luna','月見の街ルナ'],['forge','鍛冶の街ヴァル']]){
    townHeading.run(`state.node='${id}';state.zone=currentNode().zone;state.village=true;state.gold=100;state.hp=1;state.mp=0;state.companions.forEach(c=>c.hp=1);render();action('rest')`);
    assert.equal(townHeading.nodes.location.hidden,false);
    assert.equal(townHeading.nodes.location.textContent,name);
    assert.equal(townHeading.nodes.fieldMessage.hidden,true,'town does not show the rest success message');
    assert.equal(townHeading.nodes.latestLog.textContent,'');
    assert.equal(townHeading.run('state.hp'),townHeading.run('maxhp()'));
    assert.equal(townHeading.run('state.companions[0].hp'),townHeading.run('maxhp()'));
    assert.equal(townHeading.run('state.gold'),90,'inn payment is unchanged');
  }
  const townReload=boot(townHeading.storage['starlight-rpg-v1'],true);
  assert.equal(townReload.nodes.location.hidden,false,'town title survives reload');
  assert.equal(townReload.nodes.fieldMessage.hidden,true,'old inn success log remains suppressed on reload');
  townReload.run("action('shop');action('buy:herb')");
  assert.equal(townReload.nodes.location.hidden,false);
  assert.equal(townReload.nodes.fieldMessage.hidden,false,'purchase feedback stays available');
  townReload.run("state.cleared=[true,true,false];moveTo('ash')");
  assert.equal(townReload.nodes.location.hidden,true,'town title is hidden on the road');
  assert.equal(townReload.nodes.fieldMessage.hidden,false,'travel messages stay visible');
  const reordered=JSON.parse(townHeading.storage['starlight-rpg-v1']);
  reordered.zoneIds=['volcano','grassland','moon_ruins'];reordered.kills=[7,2,3];reordered.cleared=[false,true,true];
  const ordered=boot(JSON.stringify(reordered),true);
  assert.equal(ordered.run('JSON.stringify(state.kills)'),JSON.stringify([2,3,7]),'zone progress follows stable IDs after reordering');
  const shops = boot();
  const expectedStock = {home:['herb','leather'],luna:['herb','ether','iron','leather'],forge:['herb','ether','potion','star','moon']};
  for (const [town, ids] of Object.entries(expectedStock)) {
    shops.run(`state.node='${town}';state.village=true;state.enemy=null;state.gold=10000;action('shop')`);
    for (const id of ['herb','ether','potion','iron','leather','star','moon']) {
      assert.equal(shops.nodes.shopItems.innerHTML.includes('data-action="buy:'+id+'"'),ids.includes(id),town+' displays '+id);
      const before = shops.run('JSON.stringify(state)');
      shops.run(`action('buy:${id}')`);
      if (!ids.includes(id)) assert.equal(shops.run('JSON.stringify(state)'),before,'reject unlisted '+id+' in '+town);
    }
  }
  shops.run("action('shop-close')");
  assert.equal(shops.nodes.shopMenu.hidden,true,'close restores town commands');
  shops.run("action('shop');showScreen('bag')");
  assert.equal(shops.nodes.shopMenu.hidden,true,'screen navigation closes the shop');
  shops.run("tab='shop';renderInventory()");
  assert.equal(shops.run('tab'),'bag','removed shop tab falls back to the bag');
  assert.ok(!shops.nodes.inventory.innerHTML.includes('data-action="buy:'));
  shops.run("state.node='meadow';state.village=false;state.gold=10000;render()");
  assert.equal(shops.run('openShop()'),false,'no shop opening outside town');
  assert.equal(shops.nodes.shopMenu.hidden,true);
  const outside = shops.run('JSON.stringify(state)');
  shops.run("action('buy:herb')");
  assert.equal(shops.run('JSON.stringify(state)'),outside,'no purchases outside town');
  shops.run("state.node='home';state.village=true;state.enemy={hp:10}");
  assert.equal(shops.run('currentShopStock().length'),0,'no shop during battle');
  assert.equal(shops.run('openShop()'),false);
  const busyShop=boot();busyShop.run("state.node='home';state.village=true;busy=true");
  assert.equal(busyShop.run('openShop()'),false,'busy blocks shop entry');
  const reloadShop=boot(shops.storage['starlight-rpg-v1']);
  assert.equal(reloadShop.run('shopOpen'),false,'shop UI is not persisted');
  const loot = boot();
  for (const [roll, count] of [[0,4],[.0199,4],[.02,3],[.0799,3],[.08,2],[.2499,2],[.25,1],[.5499,1],[.55,0],[.99,0]]) {
    assert.equal(loot.run(`rollMaterials(bestiary[0][0],()=>${roll}).length`),count,'probability boundary '+roll);
  }
  assert.equal(loot.run("lootTable(bestiary[0][1])[0].id"),'fur');
  loot.run("state.zone=1");
  assert.equal(loot.run("lootTable(bestiary[1][0])[1].id"),'shard');
  loot.run("state.zone=0;walkTo('home');state.materials.starcore=2;state.gold=0;action('sell:starcore')");
  assert.equal(loot.run('state.materials.starcore'),1);
  assert.equal(loot.run('state.gold'),150);
  loot.run("walkTo('meadow');action('sell:starcore')");
  assert.equal(loot.run('state.materials.starcore'),1,'sell only in town');
  const migrated = boot(JSON.stringify({v:1,lv:5,xp:10,hp:70,mp:20,gold:250,weapon:'iron',armor:'cloth',owned:['twig','cloth','iron'],items:{herb:3,ether:1,potion:0},zone:1,kills:[5,2,0],cleared:[true,false,false],total:7,claimed:true,enemy:null,turn:1,log:[],village:true}));
  assert.equal(migrated.run('state.node'),'luna');
  assert.equal(migrated.run('state.lv'),5);
  assert.equal(migrated.run('state.gold'),250);
  assert.equal(migrated.run('state.weapon'),'iron');
  assert.equal(migrated.run('state.v'),2);
  const resumed = boot(loot.storage['starlight-rpg-v1']);
  assert.equal(resumed.run('state.materials.starcore'),1,'materials persist');
  assert.equal(resumed.run('state.node'),'meadow','position persists');
  const reset = boot(loot.storage['starlight-rpg-v1']);
  const beforeReset = reset.storage['starlight-rpg-v1'];
  reset.nodes.reset.onclick();
  assert.equal(reset.storage['starlight-rpg-v1'],beforeReset,'opening confirmation preserves save');
  assert.equal(reset.nodes.closeModal.textContent,'キャンセル');
  reset.nodes.closeModal.onclick();
  assert.equal(reset.storage['starlight-rpg-v1'],beforeReset,'cancel preserves save');
  reset.nodes.reset.onclick();
  const ok = reset.nodes.modalContent.children.at(-1);
  assert.equal(ok.textContent,'OK');
  ok.onclick();
  assert.equal(reset.storage['starlight-rpg-v1'],undefined,'OK deletes save without writing a replacement');
  assert.equal(reset.run('state.lv'),1);
  assert.equal(reset.run('Object.keys(state.materials).length'),0);
  assert.equal(reset.run('state.node'),'meadow');
  assert.equal(reset.run('state.gold'),30);
  reset.run("walkTo('home')");
  assert.ok(reset.storage['starlight-rpg-v1'],'next action resumes autosave');

  const rules = boot();
  assert.equal(rules.run("normalAttack.type"),'physical');
  assert.equal(rules.run("skillList.every(s=>['physical','magic'].includes(s.type))"),true);
  assert.equal(rules.run("wisdom()"),10);
  rules.run('state.lv=7');
  assert.equal(rules.run("wisdom()"),34);
  const physical = (a,d,extra='')=>rules.run(`CombatRules.physicalDamage({attack:${a},defense:${d},roll:.5${extra}})`);
  assert.equal(physical(20,30),2,'attack below defense can still deal damage');
  assert.equal(physical(20,10),7,'attack above defense deals damage');
  assert.equal(physical(0,0),0,'zero attack');
  assert.equal(physical(1,100,',roll:0.49'),0,'no forced minimum damage');
  assert.equal(physical(1,100,',roll:0.5'),1,'glancing hit can damage high defense');
  assert.equal(physical(20,40,',roll:0'),0);
  assert.equal(physical(20,40,',roll:0.999'),1);
  assert.equal(physical(0,100,',roll:0.999'),0);
  assert.equal(physical(20,30,',roll:0'),2);
  assert.equal(physical(20,30,',roll:0.999'),2);
  assert.equal(physical(20,30,',power:2.4'),6);
  assert.equal(physical(20,30,',strong:true,guard:true'),1,'modifiers round once at end');
  for(let a=0;a<80;a++)for(let d=0;d<80;d++){
    const value=physical(a,d);
    assert.ok(Number.isInteger(value)&&value>=0);
    assert.ok(physical(a+1,d)>=value,'attack increases cannot reduce damage');
    assert.ok(physical(a,d+1)<=value,'defense increases cannot increase damage');
  }
  // Exercise live battle routes rather than testing only the math helpers.
  const setup = (app,defense=20) => app.run(`state.lv=7;state.hp=maxhp();state.mp=maxmp();state.enemy={name:'試験の魔物',hp:10000,max:10000,atk:0,def:${defense},wis:999,boss:false};state.turn=1`);
  const physicalBattle=boot();setup(physicalBattle);
  const expectedAttack=physicalBattle.run('CombatRules.physicalDamage({attack:attack(),defense:20,roll:.5})');
  await physicalBattle.run("combat('attack')");
  assert.equal(physicalBattle.run('10000-state.enemy.hp'),expectedAttack);
  assert.equal(physicalBattle.run('state.hp===maxhp()'),true,'enemy zero attack causes zero damage');
  for(const roll of [0,.05,.119,.12,.5,.999]){
    setup(physicalBattle);physicalBattle.run(`Math.random=()=>${roll}`);
    const expected=physicalBattle.run(`CombatRules.physicalDamage({attack:attack(),defense:20,roll:${roll}})`);
    await physicalBattle.run("combat('attack')");
    assert.equal(physicalBattle.run('10000-state.enemy.hp'),expected,'ordinary hit for all rolls');
    assert.equal(physicalBattle.run("state.log.some(t=>t.includes('会心'))"),false);
  }
  physicalBattle.run('Math.random=()=>.5');
  setup(physicalBattle);
  const expectedSlash=physicalBattle.run('CombatRules.physicalDamage({attack:attack(),defense:20,power:2.4,roll:.5})');
  await physicalBattle.run("useSkill('slash')");
  assert.equal(physicalBattle.run('10000-state.enemy.hp'),expectedSlash);
  assert.equal(physicalBattle.run('state.mp'),physicalBattle.run('maxmp()-8'));
  for(const id of ['flame','nova']){
    const weak=boot(),tough=boot();setup(weak,0);setup(tough,1000000);
    tough.run("state.weapon='star';state.enemy.wis=1000000");
    await weak.run(`useSkill('${id}')`);await tough.run(`useSkill('${id}')`);
    assert.equal(weak.run('state.enemy.hp'),tough.run('state.enemy.hp'),'magic ignores target stats and caster weapon');
    const before=10000-weak.run('state.enemy.hp');setup(weak);weak.run('state.lv=8;state.mp=maxmp()');
    await weak.run(`useSkill('${id}')`);
    assert.ok(10000-weak.run('state.enemy.hp')>before,'wisdom increases magic damage');
  }
  const healing=boot();healing.run('state.lv=3;state.hp=1;state.mp=maxmp()');
  healing.run("useSkill('heal')");
  assert.equal(healing.run('state.hp'),53,'healing scales with wisdom');
  healing.run('state.hp=maxhp()-1;state.mp=maxmp()');healing.run("useSkill('heal')");
  assert.equal(healing.run('state.hp===maxhp()'),true,'healing capped at max HP');
  const noMP=boot();setup(noMP);noMP.run('state.mp=0');await noMP.run("useSkill('nova')");
  assert.equal(noMP.run('state.enemy.hp'),10000,'insufficient MP prevents cast');
  assert.equal(noMP.run('state.turn'),1);
  assert.equal(migrated.run('wisdom()'),26,'old saves gain derived wisdom without losing level');
  const critical=boot(null,true);
  assert.equal(critical.run('luck()'),10);
  critical.run('state.lv=5');assert.equal(critical.run('luck()'),18);
  for(const rate of [0,1,10,100,256,1000])assert.equal(critical.run('CombatRules.criticalRate('+rate+')'),Math.min(.5,rate/512));
  for(const defense of [0,1000000])assert.equal(critical.run('CombatRules.physicalDamage({attack:100,defense:'+defense+',power:2.4,critical:true,roll:.5})'),240);
  assert.equal(critical.run('CombatRules.physicalDamage({attack:0,defense:99,critical:true})'),0);
  assert.equal(critical.run('CombatRules.physicalDamage({attack:100,defense:99,power:0,critical:true})'),0);
  for(const roll of [0,.899999,.9]){
   const result=critical.run('GameRules.skillResult(skillList.find(s=>s.id===\'slash\'),{attack:100,defense:100000,luck:460.8,criticalRoll:'+roll+',roll:.5},CombatRules)');
   assert.equal(result.critical,roll<.5);
  }
  const boundary=18/512;
  for(const roll of [boundary-1e-9,boundary])assert.equal(critical.run('GameRules.skillResult(skillList.find(s=>s.id===\'slash\'),{attack:100,defense:999,luck:18,criticalRoll:'+roll+',roll:.5},CombatRules).critical'),roll<boundary);
  for(const id of ['flame','heal','nova'])assert.equal(critical.run('GameRules.skillResult(skillList.find(s=>s.id===\''+id+'\'),{wisdom:10,attack:100,defense:999,luck:10000,criticalRoll:0},CombatRules).critical'),false);
  critical.run('startBattle();state.lv=5;state.mp=maxmp();state.enemies.forEach(e=>{e.hp=10000;e.max=10000;e.def=100000;e.atk=0;});Math.random=()=>0');
  const hpBefore=critical.run('state.enemies[0].hp');
  await critical.run("partyRound('skill','slash')");
  const critDamage=critical.run('CombatRules.physicalDamage({attack:attack(),defense:0,power:2.4,critical:true,roll:0})');
  assert.equal(hpBefore-critical.run('state.enemies[0].hp'),critDamage,'live party skill ignores high defense');
  assert.equal(critical.run('state.mp'),critical.run('maxmp()-8'));
  assert.equal(critical.run("state.log.filter(t=>t.includes('会心の一撃')).length"),1);
  const legacyData=critical.run('GameData');delete legacyData.rules.growth.baseLuck;delete legacyData.rules.growth.luckPerLevel;
  assert.equal(critical.run('luck()'),18,'old published and battle definitions use compatible defaults');
  assert.equal(migrated.run('luck()'),18,'old saves retain level and gain derived luck');
  console.log('PASS: luck growth, legacy defaults, critical boundary and cap, defense bypass, party MP and critical log, magic exclusion');
  console.log('PASS: physical/magic types, wisdom growth, nonnegative damage and zero minimum, monotonic attack/defense, DQ-style base, normal attacks without critical hits, glancing hits, shared player/monster physical combat, skill power and MP, magic target-stat independence, wisdom-scaled attacks/healing and old-save compatibility');
  console.log('PASS: graph adjacency, battle movement lock, all progression gates and bosses, 3 towns, 12 monsters, shop, equipment, recovery, leveling, rarity probability boundaries, material sales, legacy save migration, persistence and confirmed save reset');
})().catch(error=>{console.error(error);process.exit(1)});
