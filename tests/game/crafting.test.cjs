// 鍛冶屋の作製：レシピの有効性、条件の検証、消費、レア以上の抽選、画面の操作。
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {boot} = require('./boot.cjs');
const rules = require('../../shared/rules.js');
const craft = require('../../shared/crafting.js');
const saves = require('../../shared/save.js');
const content = require('../../shared/content.js');
const data = content.withJobs(JSON.parse(fs.readFileSync('content/game.json', 'utf8')));
const seq = values => () => {
  if (!values.length) throw new Error('乱数が尽きました');
  return values.shift();
};
const freshState = () => {
  const app = boot(null, true);
  app.run('allies()');
  return JSON.parse(app.run('JSON.stringify(state)'));
};

// 6レシピすべてが同梱定義で使え、固有装備・ショップ外の装備を含まない。
assert.deepEqual(
  craft.list(data).map(recipe => recipe.gearId),
  ['iron', 'leather', 'moon', 'moonsteel_blade', 'starward_armor', 'star']
);
assert.equal(craft.hasSmithy('forge'), true);
assert.equal(craft.hasSmithy('luna'), false);
assert.equal(craft.hasSmithy('home'), false);
const rateSum = Object.values(craft.rarityRates).reduce((a, b) => a + b, 0);
assert.equal(Math.round(rateSum * 1e9) / 1e9, 1);

// 参照先が欠ける・固有装備・抽選ルールがない定義では使えない。
const without = mutate => {
  const copy = structuredClone(data);
  mutate(copy);
  return copy;
};
assert.equal(craft.available(without(d => (d.items = d.items.filter(e => e.id !== 'iron'))), craft.get('craft_iron')), false);
assert.equal(craft.available(without(d => (d.items.find(e => e.id === 'iron').unique = true)), craft.get('craft_iron')), false);
assert.equal(craft.available(without(d => (d.materials = d.materials.filter(e => e.id !== 'fang'))), craft.get('craft_iron')), false);
assert.equal(craft.list(without(d => delete d.rules.gearRoll)).length, 0);
assert.equal(craft.check(freshState(), data, 'missing').reason, 'unavailable');

// レアリティの境界：レア70%・エピック25%・レジェンダリー5%。コモン・アンコモンは出ない。
const rarityFor = pick => rules.rollGear(data, 'star', seq([pick, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5]), craft.rarityRates).rarity;
assert.equal(rarityFor(0), 'rare');
assert.equal(rarityFor(0.6999), 'rare');
assert.equal(rarityFor(0.7), 'epic');
assert.equal(rarityFor(0.9499), 'epic');
assert.equal(rarityFor(0.95), 'legendary');
assert.equal(rarityFor(0.9999), 'legendary');
// 省略時はドロップと同じ確率のまま（コモンが出る）。
assert.equal(rules.rollGear(data, 'star', seq([0])).rarity, 'common');

// 条件の検証：素材 → 所持金 → 所持上限。
{
  const state = freshState();
  state.gold = 1000;
  state.materials = {fur: 2, fang: 2};
  assert.equal(craft.check(state, data, 'craft_iron').reason, 'materials');
  state.materials.fur = 3;
  state.gold = 119;
  assert.equal(craft.check(state, data, 'craft_iron').reason, 'gold');
  state.gold = 120;
  assert.equal(craft.check(state, data, 'craft_iron').ok, true);
  rules.normalizeGear(state, data);
  for (let i = rules.storedGearCount(state, data); i < rules.gearStorageLimit; i++) rules.addGear(state, data, 'twig');
  assert.equal(craft.check(state, data, 'craft_iron').reason, 'full');
  const before = JSON.stringify(state);
  assert.equal(craft.craft(state, data, 'craft_iron', seq([0])).ok, false);
  assert.equal(JSON.stringify(state), before, '拒否時は何も変えない');
}

// 作製：素材とゴールドを消費し、レア以上の抽選個体を加える。保存検証を通る。
{
  const state = freshState();
  state.gold = 900;
  state.materials = {ore: 5, scale: 2, ruby: 1};
  const uid = state.nextGearUid;
  const result = craft.craft(state, data, 'craft_star', seq([0.96, 0, 0.99, 0, 0.99, 0, 0.99, 0, 0.99]));
  assert.equal(result.ok, true);
  assert.equal(result.instance.uid, uid);
  assert.equal(result.instance.rarity, 'legendary');
  assert.equal(result.instance.bonusEffects.length, 4);
  assert.equal(state.gold, 100);
  assert.deepEqual(state.materials, {ore: 1, scale: 0, ruby: 0});
  assert.equal(state.nextGearUid, uid + 1);
  assert.equal(state.owned.includes('star'), true);
  assert.deepEqual(saves.validate(state, data), []);
  // 不正な乱数では例外になり、何も消費しない。
  state.gold = 900;
  state.materials = {ore: 4, scale: 2, ruby: 1};
  const before = JSON.stringify(state);
  assert.throws(() => craft.craft(state, data, 'craft_star', seq([1])), RangeError);
  assert.equal(JSON.stringify(state), before);
}

// 画面：ヴァルにだけ鍛冶屋があり、条件を満たすレシピだけ作製できる。
{
  const app = boot(null, true);
  app.run("allies();state.node='forge';state.zone=2;state.village=true;state.journey=null;state.enemy=null;state.gold=1000;state.materials={fur:3,fang:2};render(false)");
  assert.match(app.nodes.actions.innerHTML, /data-action="smithy"/);
  app.run("action('smithy')");
  assert.equal(app.run('smithyOpen'), true);
  assert.equal(app.nodes.smithyMenu.hidden, false);
  const html = app.nodes.smithyItems.innerHTML;
  assert.match(html, /<button data-action="craft:craft_iron" >120 G<\/button>/);
  assert.match(html, /<button data-action="craft:craft_star" disabled>素材不足<\/button>/);
  assert.match(html, /やわらかな毛皮 3\/3/);
  assert.match(html, /class="short">火山鉱 0\/4/);
  // 無効なレシピは処理側でも拒否する。
  app.run("action('craft:craft_star')");
  assert.equal(app.run('state.gold'), 1000);
  assert.equal(app.run('state.log[0]'), '星銀のつるぎを作るための素材が足りない。');
  app.run("Math.random=()=>.5;action('craft:craft_iron')");
  assert.equal(app.run('state.gold'), 880);
  assert.equal(app.run('state.materials.fur'), 0);
  assert.equal(app.run('state.log[0]'), '鉄のつるぎを作製した！［レア］');
  assert.equal(app.run('smithyOpen'), true, '作製後も鍛冶屋を開いたまま');
  assert.match(app.nodes.smithyItems.innerHTML, /smithy-result/);
  assert.deepEqual(saves.validate(JSON.parse(app.run('JSON.stringify(state)')), data), []);
  // ほかの操作で閉じる。
  app.run("action('smithy-close')");
  assert.equal(app.run('smithyOpen'), false);
  // ほかの街には鍛冶屋がなく、開こうとしても開かない。
  app.run("state.node='luna';state.zone=1;render(false)");
  assert.doesNotMatch(app.nodes.actions.innerHTML, /data-action="smithy"/);
  app.run("action('smithy')");
  assert.equal(app.run('smithyOpen'), false);
  // 街の外では作製できない。
  app.run("state.node='forge';state.zone=2;action('smithy');state.village=false;state.materials={fur:3,fang:2};action('craft:craft_iron')");
  assert.equal(app.run('state.materials.fur'), 3);
}
// 購入：作製できる装備のうちコモン・アンコモンの標準品を定価で買える。
assert.deepEqual(craft.purchaseList(data), ['iron', 'leather', 'moon', 'moonsteel_blade', 'starward_armor', 'star']);
assert.deepEqual(craft.purchaseRarities, ['common', 'uncommon']);
assert.equal(craft.purchasable(data, 'eclipse_robe'), false, '固有・レアの装備は買えない');
assert.equal(craft.purchasable(data, 'twig'), false, 'レシピにない装備は買えない');
assert.equal(craft.purchasable(without(d => (d.items.find(e => e.id === 'star').rarity = 'rare')), 'star'), false);
assert.equal(craft.purchasable(without(d => (d.items.find(e => e.id === 'star').unique = true)), 'star'), false);
assert.equal(craft.purchasable(without(d => (d.items.find(e => e.id === 'star').price = 0)), 'star'), false);
assert.equal(craft.purchasable(without(d => (d.items = d.items.filter(e => e.id !== 'star'))), 'star'), false);
assert.equal(craft.purchasable(without(d => delete d.rules.gearRoll), 'star'), true, '購入は抽選ルールに依存しない');
{
  const state = freshState();
  state.gold = 419;
  assert.equal(craft.checkPurchase(state, data, 'moonsteel_blade').reason, 'gold');
  assert.equal(craft.checkPurchase(state, data, 'eclipse_robe').reason, 'unavailable');
  state.gold = 420;
  const materials = JSON.stringify(state.materials),
    uid = state.nextGearUid;
  const result = craft.buy(state, data, 'moonsteel_blade');
  assert.equal(result.ok, true);
  assert.equal(state.gold, 0);
  assert.equal(JSON.stringify(state.materials), materials, '素材は使わない');
  assert.equal(result.instance.uid, uid);
  assert.equal(result.instance.rarity, 'uncommon');
  assert.deepEqual(result.instance.bonusEffects, data.items.find(e => e.id === 'moonsteel_blade').bonusEffects);
  assert.equal(state.owned.includes('moonsteel_blade'), true);
  assert.deepEqual(saves.validate(state, data), []);
  state.gold = 1000;
  for (let i = rules.storedGearCount(state, data); i < rules.gearStorageLimit; i++) rules.addGear(state, data, 'twig');
  assert.equal(craft.checkPurchase(state, data, 'iron').reason, 'full');
  const before = JSON.stringify(state);
  assert.equal(craft.buy(state, data, 'iron').ok, false);
  assert.equal(JSON.stringify(state), before, '拒否時は何も変えない');
}

// 画面：鍛冶屋の「購入」に切り替えて標準品を買う。
{
  const app = boot(null, true);
  app.run("allies();state.node='forge';state.zone=2;state.village=true;state.journey=null;state.enemy=null;state.gold=300;render(false);action('smithy')");
  assert.equal(app.run('smithyView'), 'craft', '開いた直後は作製');
  app.run("action('smithy-view:buy')");
  assert.equal(app.run('smithyOpen'), true);
  assert.equal(app.run('smithyView'), 'buy');
  const html = app.nodes.smithyItems.innerHTML;
  assert.match(html, /<button data-action="smithy-buy:star" >220 G<\/button>/);
  assert.match(html, /<button data-action="smithy-buy:moonsteel_blade" disabled>420 G<\/button>/);
  assert.doesNotMatch(html, /data-recipe=/);
  assert.match(app.nodes.smithyNote.textContent, /コモン・アンコモン/);
  app.run("action('smithy-buy:moonsteel_blade')");
  assert.equal(app.run('state.gold'), 300, '所持金不足は処理側でも拒否');
  app.run("action('smithy-buy:star')");
  assert.equal(app.run('state.gold'), 80);
  assert.equal(app.run('state.log[0]'), '星銀のつるぎを購入した。');
  assert.equal(app.run("state.gear.at(-1).baseId+':'+state.gear.at(-1).rarity"), 'star:common');
  assert.equal(app.run('smithyOpen'), true, '購入後も鍛冶屋を開いたまま');
  assert.deepEqual(saves.validate(JSON.parse(app.run('JSON.stringify(state)')), data), []);
  // 不正な表示切り替えは無視し、街の外では購入できない。
  app.run("action('smithy-view:sell')");
  assert.equal(app.run('smithyView'), 'buy');
  app.run("state.gold=500;state.village=false;action('smithy-buy:star')");
  assert.equal(app.run('state.gold'), 500);
}
console.log('crafting tests passed');
