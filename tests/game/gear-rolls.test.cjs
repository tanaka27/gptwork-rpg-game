// ドロップ装備の抽選：レアリティの境界、追加効果の個数と範囲、分布、固有装備、検証、ゲーム内のドロップ。
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {boot} = require('./boot.cjs');
const rules = require('../../shared/rules.js');
const saves = require('../../shared/save.js');
const content = require('../../shared/content.js');
const bundled = JSON.parse(fs.readFileSync('content/game.json', 'utf8'));
const data = content.withJobs(bundled);
const sequence = values => () => values.length ? values.shift() : 0;
const seeded = seed => () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
const instanceValid = (baseId, rolled) => {
  const base = data.items.find(item => item.id === baseId), other = base.type === 'weapon' ? 'cloth' : 'twig';
  const state = {gear: [{uid: 1, baseId, ...rolled}, {uid: 2, baseId: other, rarity: 'common', bonusEffects: []}], nextGearUid: 3, owned: [baseId, other]};
  state[base.type + 'Uid'] = 1; state[(base.type === 'weapon' ? 'armor' : 'weapon') + 'Uid'] = 2;
  return rules.validateGear(state, data).length === 0;
};

// レアリティの境界：コモン70%、アンコモン22%、レア7%、レジェンダリー1%。
for (const [pick, rarity] of [[0, 'common'], [0.6999, 'common'], [0.7, 'uncommon'], [0.9199, 'uncommon'], [0.92, 'rare'], [0.9899, 'rare'], [0.99, 'legendary'], [0.99999, 'legendary']])
  assert.equal(rules.rollGear(data, 'star', sequence([pick, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5])).rarity, rarity, `pick ${pick}`);
// 追加効果：個数はレアリティどおり、能力は重複なし、数値は 係数×装備Lv×倍率 を四捨五入（最低1）。
const legendary = rules.rollGear(data, 'star', sequence([0.995, 0, 1 - 1e-12, 0, 1 - 1e-12, 0, 1 - 1e-12]));
// 倍率は[最小, 最大)なので、攻撃力0.35×Lv10×1.0=3.5に届かず3になる（検証の上限は倍率1.0で計算した4）。
assert.deepEqual(legendary, {rarity: 'legendary', bonusEffects: [{stat: 'maxHP', amount: 15}, {stat: 'attack', amount: 3}, {stat: 'defense', amount: 3}]});
const low = rules.rollGear(data, 'iron', sequence([0.75, 0.999, 0]));
assert.deepEqual(low, {rarity: 'uncommon', bonusEffects: [{stat: 'luck', amount: 1}]}, 'tiny values are at least 1');
assert.deepEqual(rules.rollGear(data, 'star', sequence([0.1])), {rarity: 'common', bonusEffects: []});
// 固有装備は抽選せず、乱数も消費しない。
let consumed = 0;
assert.deepEqual(rules.rollGear(data, 'eclipse_robe', () => { consumed++; return 0.999; }), {rarity: 'rare', bonusEffects: [{stat: 'maxHP', amount: 20}, {stat: 'wisdom', amount: 4}]});
assert.equal(consumed, 0);

// 分布と範囲：多数の抽選がすべて検証を通り、確率がおおむね定義どおり。
const counts = {common: 0, uncommon: 0, rare: 0, legendary: 0}, rng = seeded(42), maxima = {};
for (let i = 0; i < 40000; i++) {
  const baseId = ['twig', 'iron', 'star', 'cloth', 'leather', 'moon', 'moonsteel_blade', 'starward_armor'][i % 8];
  const rolled = rules.rollGear(data, baseId, rng);
  counts[rolled.rarity]++;
  assert.equal(rolled.bonusEffects.length, {common: 0, uncommon: 1, rare: 2, legendary: 3}[rolled.rarity]);
  assert.equal(new Set(rolled.bonusEffects.map(e => e.stat)).size, rolled.bonusEffects.length);
  assert.ok(instanceValid(baseId, rolled), JSON.stringify({baseId, rolled}));
  if (baseId === 'star') for (const effect of rolled.bonusEffects) maxima[effect.stat] = Math.max(maxima[effect.stat] || 0, effect.amount);
}
for (const [rarity, rate] of Object.entries(data.rules.gearRoll.rarityRates))
  assert.ok(Math.abs(counts[rarity] / 40000 - rate) < 0.01, `${rarity} ${counts[rarity]}`);
// 星銀のつるぎのレジェンダリーでも、固有の星灯りの剣（攻撃+5・素早さ+4・うんのよさ+6）を超えない。
assert.ok(maxima.attack <= 5 && maxima.speed <= 4 && maxima.luck <= 6, JSON.stringify(maxima));

// 検証の負例：範囲外、能力の重複、個数の不一致、抽選対象外の能力、固有装備の改変。
assert.ok(instanceValid('star', {rarity: 'rare', bonusEffects: [{stat: 'attack', amount: 3}, {stat: 'luck', amount: 2}]}));
for (const [label, baseId, rolled] of [
  ['above range', 'star', {rarity: 'rare', bonusEffects: [{stat: 'attack', amount: 4}, {stat: 'luck', amount: 2}]}],
  ['below range', 'star', {rarity: 'legendary', bonusEffects: [{stat: 'attack', amount: 1}, {stat: 'luck', amount: 3}, {stat: 'speed', amount: 3}]}],
  ['duplicate stat', 'star', {rarity: 'rare', bonusEffects: [{stat: 'attack', amount: 3}, {stat: 'attack', amount: 3}]}],
  ['count mismatch', 'star', {rarity: 'rare', bonusEffects: [{stat: 'attack', amount: 3}]}],
  ['stat outside the pool', 'star', {rarity: 'uncommon', bonusEffects: [{stat: 'maxMP', amount: 2}]}],
  ['fractional amount', 'star', {rarity: 'uncommon', bonusEffects: [{stat: 'attack', amount: 2.5}]}],
  ['rolled unique item', 'starlight_blade', {rarity: 'legendary', bonusEffects: [{stat: 'attack', amount: 6}, {stat: 'speed', amount: 5}, {stat: 'luck', amount: 6}]}],
  ['unknown rarity', 'star', {rarity: 'mythic', bonusEffects: []}],
]) assert.equal(instanceValid(baseId, rolled), false, label);
// 抽選ルールのない定義では標準品だけが有効（範囲を判断できないため）。
const noRoll = structuredClone(data); delete noRoll.rules.gearRoll;
assert.deepEqual(rules.rollGear(noRoll, 'star', sequence([0.999])), {rarity: 'common', bonusEffects: []});
assert.equal(rules.validateGear({gear: [{uid: 1, baseId: 'star', rarity: 'rare', bonusEffects: [{stat: 'attack', amount: 3}, {stat: 'luck', amount: 2}]}, {uid: 2, baseId: 'cloth', rarity: 'common', bonusEffects: []}], nextGearUid: 3, weaponUid: 1, armorUid: 2}, noRoll).length > 0, true);
// 旧公開定義（抽選ルール・固有指定なし）には同梱定義の値を補う。
const old = structuredClone(bundled); delete old.rules.gearRoll; old.items.forEach(item => delete item.unique);
const supplemented = content.withJobs(old, bundled);
assert.deepEqual(supplemented.rules.gearRoll, bundled.rules.gearRoll);
assert.deepEqual(supplemented.items.filter(item => item.unique).map(item => item.id), ['eclipse_robe', 'starlight_blade']);

// ゲーム内のドロップ：抽選結果を個体に保存し、能力・ログ・セーブ検証・再読み込みに反映する。
const app = boot(null, true);
app.run("allies();state.zone=2;state.lv=10");
// 13%判定、候補（星銀のつるぎ）、レジェンダリー、能力3つと倍率。
app.run('dropRolls=[0,0,.995,0,.999999,0,.999999,0,.999999]');
assert.equal(app.run('rollEquipmentDrop({boss:false},()=>dropRolls.shift())'), 'star');
const dropped = JSON.parse(app.run("JSON.stringify(state.gear[state.gear.length-1])"));
assert.equal(dropped.rarity, 'legendary');
assert.deepEqual(dropped.bonusEffects, [{stat: 'maxHP', amount: 15}, {stat: 'attack', amount: 3}, {stat: 'defense', amount: 3}]);
assert.equal(app.run('state.log[0]'), '星銀のつるぎを発見！［レジェンダリー］ もちものから装備できる。');
const beforeStats = JSON.parse(app.run('JSON.stringify(GameRules.stats(state,GameData,0))'));
app.run(`action('equip:${dropped.uid}')`);
const afterStats = JSON.parse(app.run('JSON.stringify(GameRules.stats(state,GameData,0))'));
assert.equal(afterStats.attack, beforeStats.attack + 14 + 3, 'base value plus rolled attack');
assert.equal(afterStats.maxHP, beforeStats.maxHP + 15);
assert.equal(afterStats.defense, beforeStats.defense + 3);
const savedState = JSON.parse(app.run('JSON.stringify(state)'));
assert.deepEqual(saves.validate(savedState, data), []);
const reloaded = boot(JSON.stringify(savedState), true);
reloaded.run('allies()');
assert.deepEqual(JSON.parse(reloaded.run(`JSON.stringify(state.gear.find(e=>e.uid===${dropped.uid}))`)), dropped, 'rolled values survive reload and normalization');
// 同じ装備を2本目として持ち、固有装備は標準品のまま。
app.run('dropRolls=[0,.99]');
assert.equal(app.run('rollEquipmentDrop({boss:false},()=>dropRolls.shift())'), 'starlight_blade');
app.run('dropRolls=[0,.99]');app.run('rollEquipmentDrop({boss:false},()=>dropRolls.shift())');
assert.equal(app.run("state.gear.filter(e=>e.baseId==='starlight_blade'&&e.rarity==='legendary'&&e.bonusEffects[0].amount===5).length"), 2);
console.log('PASS: gear rolls follow rarity rates and ranges, keep unique gear fixed, validate forged values and persist dropped instances');
