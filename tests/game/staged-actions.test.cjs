// 行動の開始メッセージ確認まで効果を反映しない段階処理
const assert = require('node:assert/strict');
const {boot,flush} = require('./boot.cjs');
(async () => {
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
})().catch(error=>{console.error(error);process.exit(1)});
