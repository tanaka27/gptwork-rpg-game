// 状態異常（攻撃ダウン・守備ダウン）のラウンド処理・敵の行動・表示・保存
const assert = require('node:assert/strict');
const {boot} = require('./boot.cjs');
const SaveRules = require('../../shared/save.js');
const content = require('../../content/game.json');
const setup = "state.lv=7;state.hp=maxhp();state.mp=maxmp();allies();startBattle();state.enemies.forEach(e=>{e.hp=10000;e.max=10000;e.atk=0;e.def=40;e.actions=[];});render(false)";
// 各人の行動を指定してラウンドを1回進める（指定のない人物は防御）。
const round = (app, commands = {}) => app.run(`executePartyRound(i=>Promise.resolve(${JSON.stringify(commands)}[i]||{kind:'guard'}))`);
(async () => {
  const app = boot(null, true);
  app.run(setup);
  // Single-target debuff from Rina: MP spent once, target only, refreshed not stacked.
  const rinaMP = app.run('allyMP(1)');
  await round(app, {1: {kind: 'skill', skillId: 'rina_pinning_arrow', skillTargetIndex: 2}});
  assert.equal(app.run('allyMP(1)'), rinaMP - 3);
  assert.equal(app.run('state.debuffs.length'), 1);
  assert.deepEqual(JSON.parse(app.run('JSON.stringify(state.debuffs[0])')), {side: 'enemy', target: 2, type: 'defenseDown', sourceId: 'rina_pinning_arrow', multiplier: 0.5, remainingTurns: 3, appliedTurn: 1});
  assert.equal(app.run('GameRules.enemyDefense(state,GameData,2)'), 20);
  assert.equal(app.run('GameRules.enemyDefense(state,GameData,1)'), 40);
  assert.ok(app.run("state.log.some(t=>t.includes('守備力が0.5倍に下がった（3ターン）'))"));
  assert.ok(app.nodes.enemy.innerHTML.includes('debuff-icon defenseDown'), 'enemy shows debuff badge');
  await round(app);
  assert.equal(app.run('state.debuffs[0].remainingTurns'), 2, 'decrements after the application round');
  await round(app, {1: {kind: 'skill', skillId: 'rina_pinning_arrow', skillTargetIndex: 2}});
  assert.equal(app.run('state.debuffs.length'), 1);
  assert.equal(app.run('state.debuffs[0].remainingTurns'), 3, 'recast refreshes');
  // Lower defense increases physical damage through the shared formula.
  const hit = async debuffed => {
    const a = boot(null, true);
    a.run(setup);
    if (debuffed) a.run("GameRules.applyDebuff(state,GameData,'enemy',0,{type:'defenseDown',multiplier:0.5,turns:3},'rina_pinning_arrow')");
    await round(a, {0: {kind: 'attack'}});
    return a.run('10000-state.enemies[0].hp');
  };
  assert.ok(await hit(true) > await hit(false), 'defense down raises physical damage');
  // All-enemy debuff and expiry messages.
  const wide = boot(null, true);
  wide.run(setup + ";state.enemies[3].hp=0");
  const astelMP = wide.run('state.mp');
  await round(wide, {0: {kind: 'skill', skillId: 'astel_star_break', skillTargetIndex: 0}});
  assert.equal(wide.run('state.mp'), astelMP - 7, 'MP once for all targets');
  assert.deepEqual(JSON.parse(wide.run('JSON.stringify(state.debuffs.map(d=>d.target))')), [0, 1, 2], 'fallen enemies are skipped');
  assert.ok(wide.run("state.log.some(t=>t.includes('敵3体の守備力が0.7倍に下がった'))"));
  for (const remaining of [2, 1]) { await round(wide); assert.equal(wide.run('state.debuffs[0].remainingTurns'), remaining); }
  await round(wide);
  assert.equal(wide.run('state.debuffs.length'), 0);
  assert.ok(wide.run("state.log.some(t=>t.includes('の守備力が元に戻った。'))"));
  // Enemy attack-down lowers that enemy's damage; enemy death drops its records.
  const weak = boot(null, true);
  weak.run(setup + ";state.enemies.forEach(e=>e.atk=60)");
  weak.run("GameRules.applyDebuff(state,GameData,'enemy',1,{type:'attackDown',multiplier:0.7,turns:3},'noel_weakening_prayer')");
  assert.equal(weak.run('GameRules.enemyAttack(state,GameData,1)'), 42);
  weak.run('state.enemies[1].hp=0;render(false)');
  assert.equal(weak.run('state.debuffs.length'), 0, 'defeated enemy loses debuffs');
  // Enemy actions: chosen by rate, not on strong-attack turns, and apply to allies.
  const foe = boot(null, true);
  foe.run(setup + ";state.enemies.forEach(e=>e.atk=30);state.enemies[0].actions=[{id:'armor_rend',name:'装甲裂き',rate:.6,target:'ally',effects:[{type:'defenseDown',multiplier:.7,turns:3}]}]");
  assert.equal(foe.run('GameRules.chooseEnemyAction(state,GameData,state.enemies[0],()=>.7)'), null, 'roll above rate attacks');
  assert.equal(foe.run('GameRules.chooseEnemyAction(state,GameData,state.enemies[0],()=>.1).id'), 'armor_rend');
  assert.equal(foe.run('state.turn=3;GameRules.chooseEnemyAction(state,GameData,state.enemies[0],()=>0)'), null, 'strong-attack turns always attack');
  foe.run('state.turn=1');
  await round(foe);
  const target = foe.run("state.debuffs.find(d=>d.side==='ally')?.target");
  assert.ok(['astel', 'rina', 'gald', 'noel'].includes(target), 'enemy action applied to an ally');
  const index = foe.run(`GameData.rules.party.indexOf('${target}')`);
  assert.equal(foe.run(`allyDefense(${index})`), foe.run(`Math.floor(allyStats(${index}).defense*.7)`));
  assert.ok(foe.run("state.log.some(t=>t.includes('の装甲裂き！'))"));
  assert.ok(foe.nodes.partyStatus.innerHTML.includes('debuff-icon defenseDown'));
  foe.run(`selectedCharacter=${index};renderCharacterScreen()`);
  assert.ok(foe.nodes.partyDetails.innerHTML.includes('装甲裂き'), 'status detail names the source');
  // Ally attack: buff and debuff multiply before a single floor.
  foe.run("GameRules.applyAttackBuff(state,GameData,0,skillList.find(s=>s.id==='inspire'));GameRules.applyDebuff(state,GameData,'ally','astel',{type:'attackDown',multiplier:.75,turns:2},'confusing_wingbeat')");
  assert.equal(foe.run('allyAttack(0)'), foe.run('Math.floor(allyStats(0).attack*1.5*.75)'));
  // Save and reload keep debuffs; invalid entries are rejected or dropped.
  foe.run('save()');
  const checkpoint = foe.storage['starlight-rpg-v1'];
  assert.ok(JSON.parse(checkpoint).debuffs.length >= 2);
  const resumed = boot(checkpoint, true);
  assert.equal(resumed.run('allyAttack(0)'), foe.run('allyAttack(0)'));
  assert.equal(resumed.run('state.debuffs.length'), foe.run('state.debuffs.length'));
  const parsed = JSON.parse(checkpoint);
  const errors = mutate => { const copy = structuredClone(parsed); mutate(copy); return SaveRules.validate(copy, content).length; };
  assert.equal(errors(() => {}), 0);
  assert.ok(errors(s => s.debuffs[0].multiplier = 1.2) > 0, 'multiplier range');
  assert.ok(errors(s => s.debuffs.push({...s.debuffs[0]})) > 0, 'duplicates');
  assert.ok(errors(s => s.debuffs[0].target = 'nobody') > 0, 'unknown target');
  assert.ok(errors(s => { s.enemy = null; }) > 0, 'debuffs outside battle');
  assert.equal(errors(s => delete s.debuffs), 0, 'older saves without debuffs stay valid');
  // Death, victory, escape and defeat clear debuffs.
  foe.run("setAllyHP(0,0)");
  assert.equal(foe.run("state.debuffs.filter(d=>d.target==='astel').length"), 0, 'death removes ally debuffs');
  for (const outcome of ['victory', 'escape', 'defeat']) {
    const exit = boot(null, true);
    exit.run(setup + ";GameRules.applyDebuff(state,GameData,'enemy',0,{type:'attackDown',multiplier:.7,turns:3},'noel_weakening_prayer');GameRules.applyDebuff(state,GameData,'ally','rina',{type:'defenseDown',multiplier:.7,turns:3},'armor_rend')");
    if (outcome === 'victory') { exit.run('state.enemies.forEach((e,i)=>e.hp=i?0:1)'); await round(exit, {0: {kind: 'attack'}, 1: {kind: 'attack'}, 2: {kind: 'attack'}, 3: {kind: 'attack'}}); }
    else if (outcome === 'escape') { exit.run('Math.random=()=>0'); await round(exit, {0: {kind: 'run'}}); }
    else { exit.run('state.hp=1;state.companions.forEach(a=>a.hp=0);state.enemies.forEach(e=>e.atk=100000)'); await round(exit); }
    assert.equal(exit.run('state.enemy'), null);
    assert.equal(exit.run('state.debuffs.length'), 0, outcome + ' clears debuffs');
  }
  // Invalid single target: the target falls before resolution, no MP is spent.
  const invalid = boot(null, true, true);
  invalid.run(setup);
  const noelMP = invalid.run('allyMP(3)');
  const pending = round(invalid, {3: {kind: 'skill', skillId: 'noel_weakening_prayer', skillTargetIndex: 1}});
  invalid.run('state.enemies[1].hp=0');
  for (let i = 0; i < 120 && invalid.run('busy'); i++) { invalid.nodes.fieldMessage.onclick(); for (let j = 0; j < 6; j++) await Promise.resolve(); }
  await pending;
  assert.equal(invalid.run('allyMP(3)'), noelMP, 'fallen target spends no MP');
  assert.equal(invalid.run("state.debuffs.filter(d=>d.side==='enemy').length"), 0);
  // Learning messages include the new skills.
  const learn = boot();
  learn.run('state.lv=2;state.xp=threshold()-1;startBattle();state.enemy.xp=1;win()');
  for (const entry of ['リナは「影縫いの矢」を覚えた！', 'ノエルは「弱体の祈り」を覚えた！']) assert.ok(learn.run(`state.log.includes('${entry}')`), entry);
  console.log('PASS: debuff skills (single/all), enemy actions and strong-turn exclusion, effective stats with buffs, icons/details, refresh, expiry, death/victory/escape/defeat, invalid targets and save validation');
})().catch(error => { console.error(error); process.exit(1); });
