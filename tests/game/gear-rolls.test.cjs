// ドロップ装備の抽選（5段階）：レアリティの境界、追加効果の個数と範囲、分布、固有装備、検証、ゲーム内のドロップ。
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

// レアリティの境界：コモン50%、アンコモン30%、レア12.5%、エピック5%、レジェンダリー2.5%。
for (const [pick, rarity] of [[0, 'common'], [0.4999, 'common'], [0.5, 'uncommon'], [0.7999, 'uncommon'], [0.8, 'rare'], [0.9249, 'rare'], [0.925, 'epic'], [0.9749, 'epic'], [0.975, 'legendary'], [0.99999, 'legendary']])
  assert.equal(rules.rollGear(data, 'star', sequence([pick, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5])).rarity, rarity, `pick ${pick}`);
// 追加効果：個数はレアリティどおり（0〜4つ）、能力は重複なし、数値は 係数×装備Lv×倍率 を四捨五入（最低1）。
const top = 1 - 1e-12;
const legendary = rules.rollGear(data, 'star', sequence([0.995, 0, top, 0, top, 0, top, 0, top]));
// レジェンダリーの倍率は[1.2, 1.6)。攻撃力は0.35×Lv10×1.6未満=5.6未満で、四捨五入して6。
assert.deepEqual(legendary, {rarity: 'legendary', bonusEffects: [{stat: 'maxHP', amount: 24}, {stat: 'attack', amount: 6}, {stat: 'defense', amount: 5}, {stat: 'wisdom', amount: 6}]});
const epic = rules.rollGear(data, 'star', sequence([0.95, 0, 0, 0, 0, 0, 0]));
assert.deepEqual(epic, {rarity: 'epic', bonusEffects: [{stat: 'maxHP', amount: 15}, {stat: 'attack', amount: 4}, {stat: 'defense', amount: 3}]}, 'epic uses the [1.0, 1.3) range');
const low = rules.rollGear(data, 'iron', sequence([0.6, 0.999, 0]));
assert.deepEqual(low, {rarity: 'uncommon', bonusEffects: [{stat: 'luck', amount: 1}]}, 'tiny values are at least 1');
assert.deepEqual(rules.rollGear(data, 'star', sequence([0.1])), {rarity: 'common', bonusEffects: []});
// 固有装備は抽選せず、乱数も消費しない。
let consumed = 0;
assert.deepEqual(rules.rollGear(data, 'eclipse_robe', () => { consumed++; return 0.999; }), {rarity: 'rare', bonusEffects: [{stat: 'maxHP', amount: 20}, {stat: 'wisdom', amount: 4}]});
assert.equal(consumed, 0);

// 分布と範囲：多数の抽選がすべて検証を通り、確率がおおむね定義どおり。
const counts = {common: 0, uncommon: 0, rare: 0, epic: 0, legendary: 0}, rng = seeded(42), maxima = {};
for (let i = 0; i < 40000; i++) {
  const baseId = ['twig', 'iron', 'star', 'cloth', 'leather', 'moon', 'moonsteel_blade', 'starward_armor'][i % 8];
  const rolled = rules.rollGear(data, baseId, rng);
  counts[rolled.rarity]++;
  assert.equal(rolled.bonusEffects.length, {common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4}[rolled.rarity]);
  assert.equal(new Set(rolled.bonusEffects.map(e => e.stat)).size, rolled.bonusEffects.length);
  assert.ok(instanceValid(baseId, rolled), JSON.stringify({baseId, rolled}));
  if (baseId === 'star') for (const effect of rolled.bonusEffects) maxima[effect.stat] = Math.max(maxima[effect.stat] || 0, effect.amount);
}
for (const [rarity, rate] of Object.entries(data.rules.gearRoll.rarityRates))
  assert.ok(Math.abs(counts[rarity] / 40000 - rate) < 0.01, `${rarity} ${counts[rarity]}`);
// 星銀のつるぎ（Lv10）の上限：攻撃力・かしこさ・うんのよさ+6、守備力・素早さ+5、最大HP+24。
// 固有の星灯りの剣（攻撃+5・素早さ+4・うんのよさ+6）を一部の能力で超えうる（合意済みの強さ）。
assert.deepEqual(maxima, {maxHP: 24, attack: 6, defense: 5, wisdom: 6, speed: 5, luck: 6}, JSON.stringify(maxima));

// 検証の負例：範囲外、能力の重複、個数の不一致、抽選対象外の能力、固有装備の改変。
// レア（倍率0.8〜1.1）の星銀のつるぎ：攻撃力・うんのよさは3〜4。
assert.ok(instanceValid('star', {rarity: 'rare', bonusEffects: [{stat: 'attack', amount: 3}, {stat: 'luck', amount: 4}]}));
assert.ok(instanceValid('star', {rarity: 'legendary', bonusEffects: [{stat: 'attack', amount: 4}, {stat: 'luck', amount: 6}, {stat: 'speed', amount: 4}, {stat: 'defense', amount: 5}]}));
for (const [label, baseId, rolled] of [
  ['above range', 'star', {rarity: 'rare', bonusEffects: [{stat: 'attack', amount: 5}, {stat: 'luck', amount: 4}]}],
  ['below range', 'star', {rarity: 'legendary', bonusEffects: [{stat: 'attack', amount: 3}, {stat: 'luck', amount: 5}, {stat: 'speed', amount: 5}, {stat: 'defense', amount: 4}]}],
  ['duplicate stat', 'star', {rarity: 'rare', bonusEffects: [{stat: 'attack', amount: 3}, {stat: 'attack', amount: 3}]}],
  ['count mismatch', 'star', {rarity: 'rare', bonusEffects: [{stat: 'attack', amount: 3}]}],
  ['legendary with three effects', 'star', {rarity: 'legendary', bonusEffects: [{stat: 'attack', amount: 5}, {stat: 'luck', amount: 5}, {stat: 'speed', amount: 5}]}],
  ['stat outside the pool', 'star', {rarity: 'uncommon', bonusEffects: [{stat: 'maxMP', amount: 2}]}],
  ['fractional amount', 'star', {rarity: 'uncommon', bonusEffects: [{stat: 'attack', amount: 2.5}]}],
  ['rolled unique item', 'starlight_blade', {rarity: 'legendary', bonusEffects: [{stat: 'attack', amount: 8}, {stat: 'speed', amount: 7}, {stat: 'luck', amount: 8}, {stat: 'maxHP', amount: 30}]}],
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
// エピックのない4段階の旧抽選ルールは、同梱定義の5段階ルールに置き換える（公開済みの元データは変えない）。
const fourTier = structuredClone(bundled);
fourTier.rules.gearRoll = {rarityRates: {common: 0.7, uncommon: 0.22, rare: 0.07, legendary: 0.01}, statRates: {maxHP: 1.5, attack: 0.35, defense: 0.3}, rarityRanges: {uncommon: [0.5, 0.8], rare: [0.6, 0.9], legendary: [0.7, 1.0]}};
const fourTierInput = structuredClone(fourTier);
assert.deepEqual(content.withJobs(fourTier, bundled).rules.gearRoll, bundled.rules.gearRoll);
assert.deepEqual(fourTier, fourTierInput, 'the published raw definition is not mutated');
assert.ok(content.validate(fourTier).length, 'a strict validation still rejects the four-tier rule in a new draft');
// 定義の検証：エピックは追加効果3つ。レジェンダリーは4つ（固有装備・旧定義のため3つも可）。
const defined = (rarity, count) => { const copy = structuredClone(bundled); const item = copy.items.find(e => e.id === 'eclipse_robe'); item.rarity = rarity; item.bonusEffects = ['maxHP', 'attack', 'defense', 'luck'].slice(0, count).map(stat => ({stat, amount: 1})); return content.validate(copy).length === 0; };
assert.deepEqual([defined('epic', 3), defined('epic', 2), defined('legendary', 4), defined('legendary', 3), defined('legendary', 2)], [true, false, true, true, false]);
// ショップにエピックは置けない。
const shopEpic = structuredClone(bundled); Object.assign(shopEpic.items.find(e => e.id === 'moonsteel_blade'), {rarity: 'epic', bonusEffects: [{stat: 'luck', amount: 2}, {stat: 'attack', amount: 1}, {stat: 'speed', amount: 1}]});
assert.ok(content.validate(shopEpic).some(error => error.includes('ショップにはコモン/アンコモン装備だけ')));
// 抽選の候補は4種類以上（レジェンダリーの4つを選べるように）。
const fewStats = structuredClone(bundled); fewStats.rules.gearRoll.statRates = {maxHP: 1.5, attack: 0.35, defense: 0.3};
assert.ok(content.validate(fewStats).some(error => error.includes('statRates')));
// 廃止した旧ID（normal/rare/epic/legend）の epic（追加効果2つ）は今のレアに読み替える。新しいエピック（3つ）はそのまま。
const retired = structuredClone(bundled); retired.items.find(e => e.id === 'eclipse_robe').rarity = 'epic';
assert.equal(content.withJobs(retired, bundled).items.find(e => e.id === 'eclipse_robe').rarity, 'rare');
const newEpic = structuredClone(bundled); Object.assign(newEpic.items.find(e => e.id === 'eclipse_robe'), {rarity: 'epic', bonusEffects: [{stat: 'maxHP', amount: 20}, {stat: 'wisdom', amount: 4}, {stat: 'speed', amount: 1}]});
assert.equal(content.withJobs(newEpic, bundled).items.find(e => e.id === 'eclipse_robe').rarity, 'epic');

// 旧ルールで拾った個体の移行：レジェンダリー（3つ）はエピックに、数値は今の範囲へ補正する。
const legacyState = () => {
  const app = boot(null, true); app.run('allies()');
  const s = JSON.parse(app.run('JSON.stringify(state)'));
  s.gear.push(
    {uid: s.nextGearUid, baseId: 'star', rarity: 'legendary', bonusEffects: [{stat: 'attack', amount: 3}, {stat: 'speed', amount: 2}, {stat: 'luck', amount: 3}]},
    {uid: s.nextGearUid + 1, baseId: 'star', rarity: 'rare', bonusEffects: [{stat: 'attack', amount: 2}, {stat: 'luck', amount: 3}]},
    {uid: s.nextGearUid + 2, baseId: 'iron', rarity: 'uncommon', bonusEffects: [{stat: 'luck', amount: 1}]},
    {uid: s.nextGearUid + 3, baseId: 'starlight_blade', rarity: 'legendary', bonusEffects: [{stat: 'attack', amount: 5}, {stat: 'speed', amount: 4}, {stat: 'luck', amount: 6}]},
  );
  s.nextGearUid += 4; s.owned = [...new Set(s.gear.map(e => e.baseId))];
  return s;
};
const oldSave = legacyState(), oldInput = structuredClone(oldSave);
assert.ok(saves.validate(oldSave, data).length, 'old roll values do not satisfy the new rule as-is');
const prepared = saves.prepareForLoad(oldSave, data);
assert.deepEqual(oldSave, oldInput, 'prepareForLoad works on a copy');
assert.deepEqual(saves.validate(prepared, data), []);
assert.deepEqual(prepared.gear.slice(-4).map(e => ({rarity: e.rarity, bonusEffects: e.bonusEffects})), [
  {rarity: 'epic', bonusEffects: [{stat: 'attack', amount: 4}, {stat: 'speed', amount: 3}, {stat: 'luck', amount: 4}]},
  {rarity: 'rare', bonusEffects: [{stat: 'attack', amount: 3}, {stat: 'luck', amount: 3}]},
  {rarity: 'uncommon', bonusEffects: [{stat: 'luck', amount: 1}]},
  {rarity: 'legendary', bonusEffects: [{stat: 'attack', amount: 5}, {stat: 'speed', amount: 4}, {stat: 'luck', amount: 6}]},
]);
// ゲームの読み込みでも同じ結果になり、何度正規化しても変わらない。
const loaded = boot(JSON.stringify(oldSave), true); loaded.run('allies()');
assert.deepEqual(JSON.parse(loaded.run('JSON.stringify(state.gear)')), prepared.gear);
assert.deepEqual(JSON.parse(loaded.run('JSON.stringify((GameRules.normalizeGear(state,GameData),state.gear))')), prepared.gear);

// ゲーム内のドロップ：抽選結果を個体に保存し、能力・ログ・セーブ検証・再読み込みに反映する。
const app = boot(null, true);
app.run("allies();state.zone=2;state.lv=10");
// 13%判定、候補（星銀のつるぎ）、レジェンダリー、能力4つと倍率。
app.run('dropRolls=[0,0,.995,0,.999999,0,.999999,0,.999999,0,.999999]');
assert.equal(app.run('rollEquipmentDrop({boss:false},()=>dropRolls.shift())'), 'star');
const dropped = JSON.parse(app.run("JSON.stringify(state.gear[state.gear.length-1])"));
assert.equal(dropped.rarity, 'legendary');
assert.deepEqual(dropped.bonusEffects, [{stat: 'maxHP', amount: 24}, {stat: 'attack', amount: 6}, {stat: 'defense', amount: 5}, {stat: 'wisdom', amount: 6}]);
assert.equal(app.run('state.log[0]'), '星銀のつるぎを発見！［レジェンダリー］ もちものから装備できる。');
const beforeStats = JSON.parse(app.run('JSON.stringify(GameRules.stats(state,GameData,0))'));
app.run(`action('equip:${dropped.uid}')`);
const afterStats = JSON.parse(app.run('JSON.stringify(GameRules.stats(state,GameData,0))'));
assert.equal(afterStats.attack, beforeStats.attack + 14 + 6, 'base value plus rolled attack');
assert.equal(afterStats.maxHP, beforeStats.maxHP + 24);
assert.equal(afterStats.defense, beforeStats.defense + 5);
assert.equal(afterStats.wisdom, beforeStats.wisdom + 6);
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
console.log('PASS: five-tier gear rolls follow rarity rates and ranges, keep unique gear fixed, migrate four-tier rules and instances, validate forged values and persist dropped instances');
