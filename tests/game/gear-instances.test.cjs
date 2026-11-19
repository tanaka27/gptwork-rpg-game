// 装備の個体化：旧セーブの移行、能力値の不変、1人1本の装着と交換、購入、所持上限、セーブ検証。
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {boot} = require('./boot.cjs');
const rules = require('../../shared/rules.js');
const saves = require('../../shared/save.js');
const content = require('../../shared/content.js');
const data = content.withJobs(JSON.parse(fs.readFileSync('content/game.json', 'utf8')));
const json = (app, code) => JSON.parse(app.run(`JSON.stringify(${code})`));

// 新規開始：4人分の初期装備8個体。写しは装備IDの一覧。
const fresh = boot(null, true);
fresh.run('allies()');
assert.equal(fresh.run('state.gear.length'), 8);
assert.deepEqual(json(fresh, 'state.owned'), ['twig', 'cloth']);
assert.equal(fresh.run('new Set([state.weaponUid,state.armorUid,...state.companions.flatMap(c=>[c.weaponUid,c.armorUid])]).size'), 8, 'each member wears distinct instances');
assert.equal(fresh.run('state.nextGearUid'), 9);
assert.deepEqual(saves.validate(json(fresh, 'state'), data), [], 'a fresh save validates');

// 旧 v:2（個体なし）：装着人数分の個体を作り、能力値は移行前と同じ。
const legacySave = {...json(fresh, 'state'), weapon: 'starlight_blade', armor: 'eclipse_robe', owned: ['twig', 'cloth', 'starlight_blade', 'eclipse_robe', 'iron'], lv: 16};
delete legacySave.gear; delete legacySave.nextGearUid; delete legacySave.weaponUid; delete legacySave.armorUid;
legacySave.companions = legacySave.companions.map((c, i) => { const copy = {...c}; delete copy.weaponUid; delete copy.armorUid; return i === 0 ? {...copy, weapon: 'starlight_blade'} : copy; });
const before = [0, 1, 2, 3].map(i => rules.stats(legacySave, data, i));
const migrated = boot(JSON.stringify(legacySave), true);
migrated.run('allies()');
const after = json(migrated, '[0,1,2,3].map(i=>GameRules.stats(state,GameData,i))');
assert.deepEqual(after, before, 'migration keeps every member’s stats');
assert.equal(migrated.run("state.gear.filter(e=>e.baseId==='starlight_blade').length"), 2, 'two wearers of one legacy item get two instances');
assert.equal(migrated.run("state.gear.filter(e=>e.baseId==='iron').length"), 1, 'unequipped owned gear becomes one instance');
assert.equal(migrated.run('state.gear.length'), 9);
assert.deepEqual(saves.validate(json(migrated, 'state'), data), []);
const again = json(migrated, '(GameRules.normalizeGear(state,GameData),state.gear)');
assert.equal(again.length, 9, 'normalization is idempotent');
// 移行済みセーブを読み直しても個体は増えない。
const reloaded = boot(migrated.run("JSON.stringify(state)"), true);
reloaded.run('allies()');
assert.equal(reloaded.run('state.gear.length'), 9);

// 他の人物が着けている個体を選ぶと、互いの装備を交換する。
const swap = boot(JSON.stringify(json(migrated, 'state')), true);
swap.run('allies()');
const ironUid = swap.run("state.gear.find(e=>e.baseId==='iron').uid");
swap.run(`actingAlly=2;action('equip:${ironUid}')`);
assert.equal(swap.run('state.companions[1].weapon'), 'iron');
const heroBlade = swap.run('state.weaponUid');
swap.run(`actingAlly=2;action('equip:${heroBlade}')`);
assert.equal(swap.run('state.companions[1].weapon'), 'starlight_blade');
assert.equal(swap.run('state.weapon'), 'iron', 'the previous wearer receives the swapped instance');
assert.ok(swap.run("state.log[0].includes('交換')"));
assert.deepEqual(saves.validate(json(swap, 'state'), data), []);
// 交換相手が装備レベルに届かない装備は渡さない。
swap.run("state.lv=8;state.gear.push({uid:state.nextGearUid++,baseId:'star',rarity:'common',bonusEffects:[]});state.companions[1].weaponUid=state.nextGearUid-1;state.companions[1].weapon='star';GameRules.normalizeGear(state,GameData)");
swap.run(`actingAlly=2;action('equip:${swap.run('state.weaponUid')}')`);
assert.equal(swap.run('state.weapon'), 'iron', 'swap is rejected when the other member cannot equip the returned item');
assert.ok(swap.run("state.log[0].includes('交換できません')"));

// 購入は同じ装備を何本でも。装着していない装備は30本まで。
const shop = boot(null, true);
shop.run("allies();state.node='luna';state.village=true;state.zone=1;state.cleared[0]=true;state.gold=100000;action('buy:iron');action('buy:iron')");
assert.equal(shop.run("state.gear.filter(e=>e.baseId==='iron').length"), 2);
shop.run("for(let i=0;i<40;i++)action('buy:iron')");
assert.equal(shop.run('GameRules.storedGearCount(state,GameData)'), 30);
assert.ok(shop.run("state.log[0].includes('30本まで')"));
assert.deepEqual(saves.validate(json(shop, 'state'), data), []);
// 満杯なら未所持の装備のドロップも星のしずくになる。
shop.run("state.zone=1;state.items.ether=0");
assert.equal(shop.run("rollEquipmentDrop({boss:false},(()=>{const r=[.1,.99];return()=>r.shift();})())"), 'eclipse_robe');
assert.equal(shop.run("state.gear.some(e=>e.baseId==='eclipse_robe')"), false);
assert.equal(shop.run('state.items.ether'), 1);

// 以前の版で写しを書き換えたセーブ：写しの内容を個体へ取り込む。
const edited = json(fresh, 'state');
edited.weapon = 'iron'; edited.owned.push('iron', 'leather');
const roundTrip = boot(JSON.stringify(edited), true);
roundTrip.run('allies()');
assert.equal(roundTrip.run("state.gear.find(e=>e.uid===state.weaponUid).baseId"), 'iron');
assert.equal(roundTrip.run("state.gear.some(e=>e.baseId==='leather')"), true);
assert.equal(roundTrip.run("state.gear.filter(e=>e.baseId==='twig').length"), 4, 'the replaced instance stays in the bag');

// セーブ検証の負例。
const valid = json(migrated, 'state');
for (const [label, mutate] of [
  ['duplicate uid', s => { s.gear[1].uid = s.gear[0].uid; }],
  ['unknown base', s => { s.gear[0].baseId = 'missing'; }],
  ['non-gear base', s => { s.gear[0].baseId = 'herb'; }],
  ['changed rarity', s => { s.gear.find(e => e.baseId === 'iron').rarity = 'legendary'; }],
  ['forged effect', s => { s.gear.find(e => e.baseId === 'starlight_blade').bonusEffects[0].amount = 999; }],
  ['stale next uid', s => { s.nextGearUid = 1; }],
  ['missing worn uid', s => { s.weaponUid = 9999; }],
  ['armor in weapon slot', s => { s.weaponUid = s.armorUid; }],
  ['one instance on two members', s => { s.companions[0].weaponUid = s.weaponUid; }],
  ['over storage limit', s => { for (let i = 0; i < 31; i++) s.gear.push({uid: s.nextGearUid++, baseId: 'iron', rarity: 'common', bonusEffects: []}); }],
  ['not an array', s => { s.gear = {}; }],
]) {
  const changed = structuredClone(valid);
  mutate(changed);
  assert.ok(saves.validate(changed, data).length, label);
}
// 壊れた個体は読み込み時に標準品へ戻し、進行は保持する。
const broken = structuredClone(valid);
broken.gear.find(e => e.baseId === 'iron').rarity = 'legendary';
broken.gear.push({uid: broken.gear[0].uid, baseId: 'iron', rarity: 'common', bonusEffects: []});
const repaired = boot(JSON.stringify(broken), true);
repaired.run('allies()');
assert.equal(repaired.run("state.gear.find(e=>e.baseId==='iron').rarity"), 'common');
assert.equal(repaired.run('state.lv'), 16);
assert.deepEqual(saves.validate(json(repaired, 'state'), data), []);
console.log('PASS: gear instances migrate legacy saves without stat changes, swap between members, cap storage and validate saves');
