// 戦闘メッセージの手動送り・自動送り・入力ガード・勝利メッセージ
const assert = require('node:assert/strict');
const {boot,flush} = require('./boot.cjs');
(async () => {
  const reader=boot(null,true,true);
  reader.run("startBattle();state.enemies.forEach(e=>{e.hp=1000;e.max=1000;e.atk=0;});render()");
  const beforeRound=reader.storage['starlight-rpg-v1'];
  const round=reader.run("partyRound('attack')");
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
  assert.equal(reader.run('state.lastRoundOrder.length'),2,'double input resolves only the current message');
  assert.equal(reader.run('state.turn'),1);
  reader.nodes.fieldMessage.onkeydown({key:'Enter',repeat:true,preventDefault(){}});
  await flush();
  assert.equal(reader.run('state.lastRoundOrder.length'),2,'held key does not skip messages');
  reader.nodes.fieldMessage.onkeydown({key:' ',repeat:false,preventDefault(){}});
  await flush();
  assert.equal(reader.run('state.lastRoundOrder.length'),3,'keyboard advances to the next action');
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
  // 自動送り：クリックなしでラウンドが最後まで進み、設定ボタンで手動へ戻せる。
  const auto=boot(null,true,true);
  assert.equal(auto.nodes.messageMode.textContent,'メッセージ送り：手動');
  auto.nodes.messageMode.onclick();
  assert.equal(auto.storage['starlight-rpg-message-mode'],'auto');
  assert.equal(auto.nodes.messageMode.textContent,'メッセージ送り：自動');
  assert.equal(auto.nodes.messageMode.ariaPressed,'true');
  assert.match(auto.nodes.messageNext.textContent,/自動で進みます/);
  assert.equal(auto.run("battleMessageDelay('12345')"),1050);
  assert.equal(auto.run("battleMessageDelay('x'.repeat(200))"),2600);
  auto.run("startBattle();state.enemies.forEach(e=>{e.hp=1000;e.max=1000;e.atk=0;});render()");
  const autoRound=auto.run("partyRound('attack')");
  for(let i=0;i<20&&auto.run('busy');i++)await flush();
  await autoRound;
  assert.equal(auto.run('state.turn'),2,'auto mode finishes the round without clicks');
  auto.nodes.messageMode.onclick();
  assert.equal(auto.storage['starlight-rpg-message-mode'],'manual');
  assert.equal(auto.nodes.messageNext.textContent,'クリック / タップで次へ ▾');
  console.log('PASS: battle click wait, single advance, keyboard, auto advance and mode toggle, busy/save guards and individual victory messages');
})().catch(error=>{console.error(error);process.exit(1)});
