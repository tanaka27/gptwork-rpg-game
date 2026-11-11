// 攻撃力バフ（鼓舞・気合い）のラウンド処理・表示・保存
const assert = require('node:assert/strict');
const {boot} = require('./boot.cjs');
(async () => {
  // Attack buffs use the actual round engine, not a duplicate damage formula.
  const buffed=boot(null,true);
  buffed.run("state.lv=7;state.hp=maxhp();state.mp=maxmp();allies();startBattle();state.enemies.forEach(e=>{e.hp=10000;e.max=10000;e.atk=0;e.def=0;});render(false)");
  const baseAttack=buffed.run('attack()'),buffMP=buffed.run('state.mp');
  await buffed.run("useSkill('inspire',3)");
  assert.equal(buffed.run('state.mp'),buffMP-4);
  assert.equal(buffed.run('state.buffs[0].remainingTurns'),3,'application round does not decrement');
  assert.equal(buffed.run('allyAttack(3)'),Math.floor(buffed.run('allyStats(3).attack')*1.5));
  assert.equal(buffed.run('allyAttack(0)'),baseAttack);
  assert.ok(buffed.nodes.partyStatus.innerHTML.includes('buff-icon'));
  buffed.run('selectedCharacter=3;renderCharacterScreen()');
  assert.ok(buffed.nodes.partyDetails.innerHTML.includes('残り3ターン'));
  await buffed.run("partyRound('guard')");assert.equal(buffed.run('state.buffs[0].remainingTurns'),2);
  await buffed.run("partyRound('skill','inspire',null,3)");assert.equal(buffed.run('state.buffs[0].remainingTurns'),3,'recast refreshes, does not stack');
  assert.equal(buffed.run('state.buffs.length'),1);
  const checkpoint=buffed.storage['starlight-rpg-v1'];
  const buffResumed=boot(checkpoint,true);assert.equal(buffResumed.run('state.buffs[0].remainingTurns'),3);assert.equal(buffResumed.run('allyAttack(3)'),Math.floor(buffed.run('allyStats(3).attack')*1.5));
  for(const remaining of [2,1,0]){await buffed.run("partyRound('guard')");assert.equal(buffed.run('state.buffs[0]?.remainingTurns||0'),remaining);}
  assert.equal(buffed.run('allyAttack(3)'),buffed.run('allyStats(3).attack'));assert.ok(buffed.run("state.log.some(t=>t.includes('効果が切れた'))"));
  buffed.run("GameRules.applyAttackBuff(state,GameData,3,skillList.find(s=>s.id==='inspire'));setAllyHP(3,0)");assert.equal(buffed.run('state.buffs.length'),0,'death removes buffs');
  buffed.run("GameRules.applyAttackBuff(state,GameData,0,skillList.find(s=>s.id==='inspire'));state.enemies.forEach((e,i)=>e.hp=i?0:1)");await buffed.run("partyRound('attack')");assert.equal(buffed.run('state.buffs.length'),0,'victory clears buffs');
  const outsideMP=buffed.run('state.mp');assert.equal(buffed.run("useSkill('inspire',0)"),false);assert.equal(buffed.run('state.mp'),outsideMP);
  const compareRound=async(boost,id,index=0)=>{const app=boot(null,true);app.run("state.lv=7;state.hp=maxhp();state.mp=maxmp();allies();startBattle();state.enemies.forEach(e=>{e.hp=10000;e.max=10000;e.atk=0;e.def=0;});render(false)");if(boost)app.run(`GameRules.applyAttackBuff(state,GameData,${index},skillList.find(s=>s.id==='inspire'))`);await app.run(id?`partyRound('skill','${id}',null,0)`:'partyRound(\'attack\')');return app.run('state.enemies.reduce((sum,e)=>sum+10000-e.hp,0)');};
  assert.ok(await compareRound(true)>await compareRound(false),'hero normal attack uses effective attack');
  assert.ok(await compareRound(true,null,3)>await compareRound(false),'a manually selected companion attack uses its own effective attack');
  assert.ok(await compareRound(true,'slash')>await compareRound(false,'slash'),'physical skill uses effective attack');
  assert.equal(await compareRound(true,'flame'),await compareRound(false,'flame'),'magic ignores attack buff');
  for(const outcome of ['escape','defeat']){
   const exit=boot(null,true);exit.run("state.lv=7;state.hp=maxhp();state.mp=maxmp();allies();startBattle();state.enemies.forEach(e=>{e.hp=10000;e.max=10000;e.atk=0;});GameRules.applyAttackBuff(state,GameData,0,skillList.find(s=>s.id==='inspire'))");
   if(outcome==='escape'){exit.run('Math.random=()=>0');await exit.run("partyRound('run')");}
   else{exit.run('state.hp=1;state.companions.forEach(a=>a.hp=0);state.enemies.forEach(e=>e.atk=100000)');await exit.run("partyRound('guard')");}
   assert.equal(exit.run('state.enemy'),null);assert.equal(exit.run('state.buffs.length'),0,outcome+' clears buffs');
  }
  const invalidBuff=boot(null,true,true);
  invalidBuff.run("state.lv=7;state.hp=maxhp();state.mp=maxmp();GameData.characters[0].speed=999;allies();startBattle();state.enemies.forEach(e=>{e.hp=10000;e.max=10000;e.atk=0;});render(false)");
  const invalidMP=invalidBuff.run('state.mp'),invalidRound=invalidBuff.run("partyRound('skill','inspire',null,1)");
  for(let i=0;i<10;i++)await Promise.resolve();
  assert.equal(invalidBuff.run('state.buffs.length'),0);assert.equal(invalidBuff.run('state.mp'),invalidMP);
  invalidBuff.run('setAllyHP(1,0)');invalidBuff.nodes.fieldMessage.onclick();
  for(let i=0;i<10;i++)await Promise.resolve();
  assert.equal(invalidBuff.run('state.buffs.length'),0,'death after announcement prevents buff');assert.equal(invalidBuff.run('state.mp'),invalidMP,'invalid target spends no MP');
  for(let i=0;i<80&&invalidBuff.run('busy');i++){invalidBuff.nodes.fieldMessage.onclick();for(let j=0;j<6;j++)await Promise.resolve();}
  await invalidRound;
  const learnBuff=boot();learnBuff.run("state.xp=threshold()-1;startBattle();state.enemy.xp=1;win()");for(const entry of ['アステルは「鼓舞」を覚えた！','アステルは「火花の魔法」を覚えた！','リナは「ねらい撃ち」を覚えた！','ガルドは「気合い」を覚えた！','ノエルは「祈りの光」を覚えた！'])assert.ok(learnBuff.run(`state.log.includes('${entry}')`),entry);
  console.log('PASS: buff skill rounds, target attack, display, refresh, expiry, death/victory, save reload and physical/magic integration');
})().catch(error=>{console.error(error);process.exit(1)});
