(function (root, factory) {
  const api = factory(typeof module === 'object' ? require('./rules.js') : root.GameRules);
  if (typeof module === 'object') module.exports = api;
  else root.CraftRules = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, gameRules => {
  'use strict';

  // 鍛冶屋のレシピ。依頼と同じくゲーム側の固定ルールで、公開コンテンツ定義には含めない。
  // 装備・素材はIDで参照し、公開定義に無い・抽選できない装備のレシピは使えない（available）。
  const catalog = [
    { id: 'craft_iron', gearId: 'iron', materials: { fur: 3, fang: 2 }, gold: 120 },
    { id: 'craft_leather', gearId: 'leather', materials: { fur: 4, sap: 2 }, gold: 100 },
    { id: 'craft_moon', gearId: 'moon', materials: { dust: 4, shard: 2 }, gold: 300 },
    { id: 'craft_moonsteel_blade', gearId: 'moonsteel_blade', materials: { shard: 3, pearl: 1 }, gold: 600 },
    { id: 'craft_starward_armor', gearId: 'starward_armor', materials: { dust: 3, pearl: 1 }, gold: 520 },
    { id: 'craft_star', gearId: 'star', materials: { ore: 4, scale: 2, ruby: 1 }, gold: 800 },
  ].map(recipe => Object.freeze({ ...recipe, materials: Object.freeze({ ...recipe.materials }) }));
  const byId = new Map(catalog.map(recipe => [recipe.id, recipe]));
  // 鍛冶屋のある街ノード。
  const townNodes = Object.freeze(['forge']);
  // 作製品のレアリティ確率（レア以上が確定）。追加効果の個数と数値は rules.gearRoll に従う。
  const rarityRates = Object.freeze({ common: 0, uncommon: 0, rare: 0.7, epic: 0.25, legendary: 0.05 });

  const hasSmithy = nodeId => townNodes.includes(nodeId);
  const get = id => byId.get(id) || null;
  function gearBase(data, id) {
    return (data?.items || []).find(item => item.id === id && item.category === 'gear') || null;
  }
  // レシピの参照先がすべて今の定義にあり、抽選できる装備なら使える。
  function available(data, recipe) {
    if (!recipe) return false;
    const base = gearBase(data, recipe.gearId);
    return (
      !!base &&
      gameRules.gearRollable(data, base) &&
      Object.keys(recipe.materials).every(id => (data.materials || []).some(material => material.id === id))
    );
  }
  function list(data) {
    return catalog.filter(recipe => available(data, recipe));
  }
  const hasMaterials = (state, recipe) =>
    Object.entries(recipe.materials).every(([id, count]) => (state.materials?.[id] || 0) >= count);
  // 作製できるかどうか。理由は表示の優先順（素材 → 所持金 → 所持上限）。
  function check(state, data, id) {
    const recipe = get(id);
    if (!available(data, recipe)) return { ok: false, reason: 'unavailable' };
    if (!hasMaterials(state, recipe)) return { ok: false, reason: 'materials', recipe };
    if (!Number.isSafeInteger(state.gold) || state.gold < recipe.gold) return { ok: false, reason: 'gold', recipe };
    if (gameRules.storedGearCount(state, data) >= gameRules.gearStorageLimit)
      return { ok: false, reason: 'full', recipe };
    return { ok: true, recipe };
  }
  // 素材とゴールドを消費して装備1本を加える。街にいるかどうかは呼び出し側で確かめる。
  // 抽選の乱数が不正なら RangeError を投げ、何も消費しない。
  function craft(state, data, id, rng = Math.random) {
    gameRules.normalizeGear(state, data);
    const result = check(state, data, id);
    if (!result.ok) return result;
    const { recipe } = result,
      rolled = gameRules.rollGear(data, recipe.gearId, rng, rarityRates),
      instance = { uid: state.nextGearUid, baseId: recipe.gearId, ...rolled };
    for (const [materialId, count] of Object.entries(recipe.materials)) state.materials[materialId] -= count;
    state.gold -= recipe.gold;
    state.nextGearUid += 1;
    state.gear.push(instance);
    state.owned = [...new Set(state.gear.map(e => e.baseId))];
    return { ok: true, recipe, instance, item: gameRules.gearItem(data, instance) };
  }

  // 鍛冶屋で購入できる標準品のレアリティ。レア以上は作製（またはドロップ）でしか手に入らない。
  const purchaseRarities = Object.freeze(['common', 'uncommon']);
  // 購入できる装備：レシピの装備のうち、定義にあり、固有装備でなく、標準品がコモンかアンコモンで価格があるもの。
  function purchasable(data, gearId) {
    const base = gearBase(data, gearId);
    return (
      !!base &&
      catalog.some(recipe => recipe.gearId === gearId) &&
      !base.unique &&
      purchaseRarities.includes(base.rarity || 'common') &&
      Number.isSafeInteger(base.price) &&
      base.price > 0
    );
  }
  function purchaseList(data) {
    return [...new Set(catalog.map(recipe => recipe.gearId))].filter(id => purchasable(data, id));
  }
  // 購入できるかどうか。理由は表示の優先順（所持金 → 所持上限）。
  function checkPurchase(state, data, gearId) {
    if (!purchasable(data, gearId)) return { ok: false, reason: 'unavailable' };
    const item = gearBase(data, gearId);
    if (!Number.isSafeInteger(state.gold) || state.gold < item.price) return { ok: false, reason: 'gold', item };
    if (gameRules.storedGearCount(state, data) >= gameRules.gearStorageLimit)
      return { ok: false, reason: 'full', item };
    return { ok: true, item };
  }
  // ゴールドを払って標準品1本を加える。街にいるかどうかは呼び出し側で確かめる。
  function buy(state, data, gearId) {
    gameRules.normalizeGear(state, data);
    const result = checkPurchase(state, data, gearId);
    if (!result.ok) return result;
    const instance = gameRules.addGear(state, data, gearId);
    state.gold -= result.item.price;
    state.owned = [...new Set(state.gear.map(e => e.baseId))];
    return { ok: true, item: result.item, instance };
  }

  return Object.freeze({
    catalog,
    townNodes,
    rarityRates,
    purchaseRarities,
    hasSmithy,
    get,
    available,
    list,
    check,
    craft,
    purchasable,
    purchaseList,
    checkPurchase,
    buy,
  });
});
