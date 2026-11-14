(function (root, factory) {
  const api = factory();
  if (typeof module === 'object') module.exports = api;
  else root.GameContent = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, () => {
  'use strict';
  const categories = ['characters', 'zones', 'monsters', 'items', 'skills', 'nodes', 'rarities', 'materials', 'shops'];
  const effectTypes = [
    'physicalDamage',
    'magicDamage',
    'magicHeal',
    'restoreHP',
    'restoreMP',
    'attackBuff',
    'attackDown',
    'defenseDown',
  ];
  const debuffEffectTypes = ['attackDown', 'defenseDown'];
  const equipmentRarities = ['common', 'uncommon', 'rare', 'legendary'];
  const bonusEffectStats = ['maxHP', 'maxMP', 'attack', 'defense', 'wisdom', 'speed', 'luck'];
  const safeId = id => typeof id === 'string' && /^[a-z][a-z0-9_-]{0,63}$/.test(id);
  function validate(data) {
    const errors = [];
    const add = (path, message) => errors.push(path + ': ' + message);
    if (!data || typeof data !== 'object' || data.schemaVersion !== 1)
      return ['schemaVersion: 1の定義データが必要です'];
    const indexes = {};
    function safeText(value, path) {
      if (typeof value === 'string' && /[<>]/.test(value)) add(path, 'HTMLの山括弧は使用できません');
      else if (Array.isArray(value)) value.forEach((v, i) => safeText(v, path + '[' + i + ']'));
      else if (value && typeof value === 'object')
        for (const [key, v] of Object.entries(value)) safeText(v, path + '.' + key);
    }
    safeText(data, 'content');
    for (const key of categories) {
      if (!Array.isArray(data[key]) || !data[key].length) {
        add(key, '空でない配列が必要です');
        indexes[key] = new Set();
        continue;
      }
      const ids = (indexes[key] = new Set());
      data[key].forEach((entry, i) => {
        const path = key + '[' + i + ']';
        if (!entry || typeof entry !== 'object') {
          add(path, 'オブジェクトが必要です');
          return;
        }
        if (!safeId(entry.id) || ids.has(entry.id)) add(path + '.id', 'IDが不正または重複しています');
        ids.add(entry.id);
        if (key !== 'shops' && (typeof entry.name !== 'string' || !entry.name.trim() || entry.name.length > 100))
          add(path + '.name', '1〜100文字の名前が必要です');
        for (const field of ['hp', 'atk', 'def', 'wis', 'xp', 'gold', 'speed', 'price', 'value', 'cost', 'lv', 'kills'])
          if (field in entry && (!Number.isSafeInteger(entry[field]) || entry[field] < 0 || entry[field] > 100000000))
            add(path + '.' + field, '範囲内の数値が必要です');
      });
    }
    if (errors.length) return errors;
    const ref = (key, id, path) => {
      if (!indexes[key]?.has(id)) add(path, '参照先がありません: ' + String(id));
    };
    const effects = (entry, path) => {
      if (!Array.isArray(entry.effects) || !entry.effects.length) {
        add(path + '.effects', '効果を1つ以上指定してください');
        return;
      }
      entry.effects.forEach((effect, i) => {
        if (!effect || !effectTypes.includes(effect.type)) {
          add(path + '.effects[' + i + ']', '未対応の効果です');
          return;
        }
        if (
          ['restoreHP', 'restoreMP'].includes(effect.type) &&
          !effect.full &&
          (!Number.isFinite(effect.amount) || effect.amount < 0)
        )
          add(path + '.effects[' + i + '].amount', '回復量が必要です');
        if (
          effect.type === 'attackBuff' &&
          (!Number.isFinite(effect.multiplier) ||
            effect.multiplier <= 1 ||
            effect.multiplier > 3 ||
            !Number.isSafeInteger(effect.turns) ||
            effect.turns < 1 ||
            effect.turns > 99)
        )
          add(path + '.effects[' + i + ']', '攻撃上昇は倍率1超〜3・継続ターン1〜99の整数が必要です');
        if (
          debuffEffectTypes.includes(effect.type) &&
          (!Number.isFinite(effect.multiplier) ||
            effect.multiplier < 0.3 ||
            effect.multiplier >= 1 ||
            !Number.isSafeInteger(effect.turns) ||
            effect.turns < 1 ||
            effect.turns > 99)
        )
          add(path + '.effects[' + i + ']', '能力低下は倍率0.3以上1未満・継続ターン1〜99の整数が必要です');
        for (const field of ['amount', 'base', 'power'])
          if (
            effect[field] != null &&
            (!Number.isFinite(effect[field]) || effect[field] < 0 || effect[field] > 100000000)
          )
            add(path + '.effects[' + i + '].' + field, '非負の数値が必要です');
      });
    };
    for (const e of data.characters || []) {
      if (!Number.isFinite(e.speed) || e.speed < 0) add('characters.' + e.id + '.speed', '素早さが必要です');
      if (e.job !== undefined && (typeof e.job !== 'string' || !e.job.trim() || e.job.length > 40))
        add('characters.' + e.id + '.job', '1〜40文字のジョブ名が必要です');
    }
    for (const e of data.characters || [])
      if (e.stats !== undefined) {
        const allowed = [
          'baseHP',
          'hpPerLevel',
          'baseMP',
          'mpPerLevel',
          'baseAttack',
          'attackPerLevel',
          'baseDefense',
          'defensePerLevel',
          'baseWisdom',
          'wisdomPerLevel',
          'baseLuck',
          'luckPerLevel',
        ];
        if (!e.stats || typeof e.stats !== 'object' || Array.isArray(e.stats))
          add('characters.' + e.id + '.stats', '個別成長はオブジェクトが必要です');
        else
          for (const [key, value] of Object.entries(e.stats))
            if (
              !allowed.includes(key) ||
              !Number.isSafeInteger(value) ||
              value < (key === 'baseHP' ? 1 : 0) ||
              value > 100000000
            )
              add('characters.' + e.id + '.stats.' + key, '範囲内の個別成長値が必要です');
      }
    for (const e of data.monsters || []) {
      ref('zones', e.zoneId, 'monsters.' + e.id + '.zoneId');
      if (!Number.isFinite(e.hp) || e.hp <= 0) add('monsters.' + e.id + '.hp', 'HPは正の値が必要です');
      if (!Array.isArray(e.drops)) add('monsters.' + e.id + '.drops', '素材IDの配列が必要です');
      else e.drops.forEach(id => ref('materials', id, 'monsters.' + e.id + '.drops'));
      if (e.actions !== undefined) {
        const path = 'monsters.' + e.id + '.actions';
        if (!Array.isArray(e.actions) || e.actions.length > 4) add(path, '行動は4件以内の配列が必要です');
        else {
          const actionIds = new Set();
          e.actions.forEach((action, i) => {
            const actionPath = path + '[' + i + ']';
            if (!action || typeof action !== 'object' || Array.isArray(action)) {
              add(actionPath, 'オブジェクトが必要です');
              return;
            }
            if (!safeId(action.id) || actionIds.has(action.id)) add(actionPath + '.id', 'IDが不正または重複しています');
            actionIds.add(action.id);
            if (typeof action.name !== 'string' || !action.name.trim() || action.name.length > 40)
              add(actionPath + '.name', '1〜40文字の名前が必要です');
            if (!Number.isFinite(action.rate) || action.rate <= 0 || action.rate > 1)
              add(actionPath + '.rate', '確率は0より大きく1以下です');
            if (!['ally', 'allAllies'].includes(action.target))
              add(actionPath + '.target', '対象はallyまたはallAlliesです');
            effects(action, actionPath);
            if (
              !Array.isArray(action.effects) ||
              action.effects.length !== 1 ||
              !debuffEffectTypes.includes(action.effects[0]?.type)
            )
              add(actionPath + '.effects', '魔物の行動には能力低下を1件指定してください');
          });
        }
      }
    }
    for (const e of data.zones || []) {
      ref('monsters', e.bossId, 'zones.' + e.id + '.bossId');
      if (e.bonusItemId !== undefined) {
        ref('items', e.bonusItemId, 'zones.' + e.id + '.bonusItemId');
        if (!data.items?.some(item => item.id === e.bonusItemId && item.category === 'gear'))
          add('zones.' + e.id + '.bonusItemId', '装備IDが必要です');
      }
      if (e.equipmentDropIds !== undefined) {
        if (!Array.isArray(e.equipmentDropIds) || !e.equipmentDropIds.length)
          add('zones.' + e.id + '.equipmentDropIds', '装備IDを1つ以上指定してください');
        else {
          if (new Set(e.equipmentDropIds).size !== e.equipmentDropIds.length)
            add('zones.' + e.id + '.equipmentDropIds', '装備IDは重複できません');
          for (const id of e.equipmentDropIds) {
            ref('items', id, 'zones.' + e.id + '.equipmentDropIds');
            if (!data.items?.some(item => item.id === id && item.category === 'gear'))
              add('zones.' + e.id + '.equipmentDropIds', '装備IDが必要です: ' + id);
          }
        }
      }
    }
    for (const e of data.nodes || []) {
      ref('zones', e.zoneId, 'nodes.' + e.id + '.zoneId');
      if (!Array.isArray(e.links)) add('nodes.' + e.id + '.links', '接続先の配列が必要です');
      else
        for (const id of e.links) {
          ref('nodes', id, 'nodes.' + e.id + '.links');
          const other = data.nodes.find(n => n.id === id);
          if (other && !other.links?.includes(e.id))
            add('nodes.' + e.id + '.links', '接続は双方向にしてください: ' + id);
        }
    }
    for (const e of data.materials || []) ref('rarities', e.rarity, 'materials.' + e.id + '.rarity');
    for (const e of data.rarities || [])
      if (!Number.isFinite(e.rate) || e.rate < 0 || e.rate > 1) add('rarities.' + e.id + '.rate', '確率は0〜1です');
    for (const e of data.shops || []) {
      ref('nodes', e.nodeId, 'shops.' + e.id + '.nodeId');
      if (!data.nodes?.find(n => n.id === e.nodeId)?.town) add('shops.' + e.id, '街にだけお店を配置できます');
      if (!Array.isArray(e.itemIds)) add('shops.' + e.id + '.itemIds', '商品IDの配列が必要です');
      else
        e.itemIds.forEach(id => {
          ref('items', id, 'shops.' + e.id + '.itemIds');
          const item = data.items.find(row => row.id === id);
          if (item?.category === 'gear' && ['rare', 'legendary'].includes(item.rarity ?? 'common'))
            add('shops.' + e.id + '.itemIds', 'ショップにはコモン/アンコモン装備だけを置けます: ' + id);
        });
    }
    for (const e of data.skills || []) {
      effects(e, 'skills.' + e.id);
      if (e.characterId !== undefined) ref('characters', e.characterId, 'skills.' + e.id + '.characterId');
      if (
        e.target !== undefined &&
        (e.effect === 'buff'
          ? !['ally', 'self'].includes(e.target)
          : !['damage', 'debuff'].includes(e.effect) || e.target !== 'allEnemies')
      )
        add('skills.' + e.id + '.target', '補助技能の対象はallyまたはself、攻撃・弱体技能の対象はallEnemiesです');
      if (!['damage', 'heal', 'buff', 'debuff'].includes(e.effect) || !['physical', 'magic'].includes(e.type))
        add('skills.' + e.id, '攻撃/回復/補助/弱体と物理/魔法の分類が必要です');
      if (e.effect === 'buff' && (e.effects?.length !== 1 || e.type !== 'physical'))
        add('skills.' + e.id + '.effects', '補助特技には攻撃力上昇を1件指定してください');
      if (e.effect === 'debuff' && (e.effects?.length !== 1 || e.type !== 'magic'))
        add('skills.' + e.id + '.effects', '弱体特技は魔法に分類し、能力低下を1件指定してください');
      for (const effect of Array.isArray(e.effects) ? e.effects : [])
        if (
          e.effect === 'buff'
            ? effect?.type !== 'attackBuff'
            : e.effect === 'debuff'
              ? !debuffEffectTypes.includes(effect?.type)
              : e.effect === 'heal'
                ? effect?.type !== 'magicHeal'
                : !['physicalDamage', 'magicDamage'].includes(effect?.type)
        )
          add('skills.' + e.id + '.effects', '対象の種類と効果が一致しません');
    }
    for (const e of data.items || []) {
      if (!['gear', 'consumable'].includes(e.category))
        add('items.' + e.id + '.category', 'gearまたはconsumableが必要です');
      if (e.category === 'consumable') {
        effects(e, 'items.' + e.id);
        if (Array.isArray(e.effects) && e.effects.some(effect => effect?.type === 'attackBuff'))
          add('items.' + e.id + '.effects', '攻撃力上昇はスキル専用です');
        if (Array.isArray(e.effects) && e.effects.some(effect => debuffEffectTypes.includes(effect?.type)))
          add('items.' + e.id + '.effects', '能力低下は特技と魔物の行動専用です');
      } else {
        if (!['weapon', 'armor'].includes(e.type)) add('items.' + e.id + '.type', 'weaponまたはarmorが必要です');
        const hasRarity = Object.hasOwn(e, 'rarity'),
          hasBonus = Object.hasOwn(e, 'bonusEffects'),
          path = 'items.' + e.id;
        if (hasRarity !== hasBonus) add(path, 'rarityとbonusEffectsを両方指定してください');
        if (hasRarity || hasBonus) {
          if (!equipmentRarities.includes(e.rarity))
            add(path + '.rarity', 'common/uncommon/rare/legendaryのいずれかが必要です');
          if (!Array.isArray(e.bonusEffects)) add(path + '.bonusEffects', '追加効果の配列が必要です');
          else {
            const required = { common: 0, uncommon: 1, rare: 2, legendary: 3 }[e.rarity];
            if (required !== undefined && e.bonusEffects.length !== required)
              add(path + '.bonusEffects', 'レアリティに合う個数の追加効果が必要です');
            const seen = new Set();
            e.bonusEffects.forEach((effect, i) => {
              if (!effect || typeof effect !== 'object' || !bonusEffectStats.includes(effect.stat))
                add(path + '.bonusEffects[' + i + '].stat', '対応する能力値を指定してください');
              if (seen.has(effect?.stat)) add(path + '.bonusEffects[' + i + '].stat', '能力値は重複できません');
              seen.add(effect?.stat);
              if (!Number.isSafeInteger(effect?.amount) || effect.amount < 1 || effect.amount > 100000000)
                add(path + '.bonusEffects[' + i + '].amount', '1〜100000000の整数が必要です');
            });
          }
        }
      }
    }
    const r = data.rules;
    if (!r?.growth || !r.travel || !r.battle || !r.inn) add('rules', '成長・道中・戦闘・宿屋の設定が必要です');
    else {
      if (!r.normalAttack || !Number.isFinite(r.normalAttack.power) || r.normalAttack.power < 0)
        add('rules.normalAttack', '通常攻撃の倍率が必要です');
      if (!Number.isSafeInteger(r.battle.guardMPRestore) || r.battle.guardMPRestore < 0)
        add('rules.battle.guardMPRestore', '防御時のMP回復量が必要です');
      for (const key of [
        'baseHP',
        'hpPerLevel',
        'baseMP',
        'mpPerLevel',
        'baseAttack',
        'attackPerLevel',
        'baseDefense',
        'defensePerLevel',
        'baseWisdom',
        'wisdomPerLevel',
        'baseExperience',
        'experiencePerLevel',
        'maxLevel',
      ])
        if (!Number.isSafeInteger(r.growth[key]) || r.growth[key] < 0)
          add('rules.growth.' + key, '非負の整数が必要です');
      for (const key of ['baseLuck', 'luckPerLevel'])
        if (key in r.growth && (!Number.isSafeInteger(r.growth[key]) || r.growth[key] < 0 || r.growth[key] > 100000000))
          add('rules.growth.' + key, '範囲内の非負の整数が必要です');
      if (!r.growth.baseHP || !r.growth.maxLevel) add('rules.growth', 'HPとレベル上限は1以上です');
      if (!Number.isInteger(r.battle.strongEvery) || r.battle.strongEvery < 1)
        add('rules.battle.strongEvery', '1以上の整数が必要です');
      if (!Number.isSafeInteger(r.inn.price) || r.inn.price < 0) add('rules.inn.price', '宿代は非負の整数です');
      for (const [section, values] of Object.entries(r)) {
        for (const [key, value] of Object.entries(values))
          if (typeof value === 'number' && (!Number.isFinite(value) || value < 0))
            add('rules.' + section + '.' + key, '非負の数値が必要です');
      }
      if (!Number.isInteger(r.travel.steps) || r.travel.steps < 1) add('rules.travel.steps', '1以上の整数が必要です');
      for (const [section, key] of [
        ['travel', 'battleRate'],
        ['travel', 'materialRate'],
        ['battle', 'escapeRate'],
        ['battle', 'rescueRate'],
      ])
        if (!(r[section][key] >= 0 && r[section][key] <= 1)) add('rules.' + section + '.' + key, '0〜1の値が必要です');
      if (!Array.isArray(r.party) || r.party.length !== 4) add('rules.party', '初期隊列には4人のIDを指定してください');
      else {
        r.party.forEach(id => ref('characters', id, 'rules.party'));
        if (new Set(r.party).size !== r.party.length) add('rules.party', '隊列のIDは重複できません');
      }
      for (const zone of data.zones || []) {
        if (zone.travelMaterials && (!Array.isArray(zone.travelMaterials) || !zone.travelMaterials.length))
          add('zones.' + zone.id + '.travelMaterials', '素材を1つ以上指定してください');
        else for (const id of zone.travelMaterials || []) ref('materials', id, 'zones.' + zone.id + '.travelMaterials');
        if (!data.monsters?.some(e => e.zoneId === zone.id && !e.boss))
          add('zones.' + zone.id, '通常の敵を1体以上登録してください');
      }
    }
    return errors;
  }
  function collisionId(id, used) {
    for (let suffix = 1; ; suffix++) {
      const tail = '_builtin' + (suffix === 1 ? '' : '_' + suffix),
        candidate = id.slice(0, 64 - tail.length) + tail;
      if (safeId(candidate) && !used.has(candidate)) return candidate;
    }
  }
  function normalizeEquipmentRarities(data) {
    if (!data || typeof data !== 'object') return data;
    const result = JSON.parse(JSON.stringify(data));
    for (const item of Array.isArray(result.items) ? result.items : []) {
      if (item?.category !== 'gear') continue;
      if (!Object.hasOwn(item, 'rarity') && !Object.hasOwn(item, 'bonusEffects')) {
        item.rarity = 'common';
        item.bonusEffects = [];
      } else if (item.rarity === 'normal') item.rarity = 'common';
      else if (item.rarity === 'epic') item.rarity = 'rare';
      else if (item.rarity === 'legend') item.rarity = 'legendary';
      else if (item.rarity === 'rare' && Array.isArray(item.bonusEffects) && item.bonusEffects.length === 1)
        item.rarity = 'uncommon';
    }
    return result;
  }
  function withJobs(data, defaults = data) {
    const legacyGearIds = new Set(
      (Array.isArray(data?.items) ? data.items : [])
        .filter(
          item => item?.category === 'gear' && !Object.hasOwn(item, 'rarity') && !Object.hasOwn(item, 'bonusEffects')
        )
        .map(item => item.id)
    );
    const oldEquipment =
      legacyGearIds.size > 0 &&
      Array.isArray(data?.items) &&
      Array.isArray(data?.zones) &&
      data.items.filter(item => item.category === 'gear').every(item => legacyGearIds.has(item.id)) &&
      data.zones.every(zone => zone.equipmentDropIds === undefined);
    const result = normalizeEquipmentRarities(data),
      errors = validate(result);
    if (errors.length) throw new Error(errors.join('\n'));
    let normalizedDefaults = defaults,
      defaultErrors = validate(normalizedDefaults);
    if (defaultErrors.length) {
      normalizedDefaults = normalizeEquipmentRarities(defaults);
      defaultErrors = validate(normalizedDefaults);
    }
    if (defaultErrors.length) throw new Error(defaultErrors.join('\n'));
    const defaultCharacters = new Map(normalizedDefaults.characters.map(character => [character.id, character])),
      party = new Set(result.rules.party);
    const builtinIds = new Set(['moonsteel_blade', 'starward_armor', 'eclipse_robe', 'starlight_blade']),
      usedItemIds = new Set(result.items.map(item => item.id)),
      builtinItemIds = new Map();
    for (const item of result.items.filter(row => row.category === 'gear'))
      if (!Object.hasOwn(item, 'rarity') && !Object.hasOwn(item, 'bonusEffects')) {
        item.rarity = 'common';
        item.bonusEffects = [];
      }
    for (const fallback of normalizedDefaults.items.filter(
      item => item.category === 'gear' && builtinIds.has(item.id)
    )) {
      const existing = result.items.find(item => item.id === fallback.id);
      let id = fallback.id;
      const carried = result.items.find(
        item =>
          item.category === 'gear' &&
          item.id.startsWith(fallback.id + '_builtin') &&
          Object.hasOwn(item, 'rarity') &&
          Object.hasOwn(item, 'bonusEffects')
      );
      if (carried) {
        builtinItemIds.set(fallback.id, carried.id);
        continue;
      }
      if (existing) {
        if (
          existing.category === 'gear' &&
          !legacyGearIds.has(existing.id) &&
          Object.hasOwn(existing, 'rarity') &&
          Object.hasOwn(existing, 'bonusEffects')
        ) {
          builtinItemIds.set(fallback.id, id);
          continue;
        }
        id = collisionId(id, usedItemIds);
      }
      const addition = JSON.parse(JSON.stringify(fallback));
      addition.id = id;
      result.items.push(addition);
      usedItemIds.add(id);
      builtinItemIds.set(fallback.id, id);
    }
    for (const zone of result.zones) {
      if (zone.equipmentDropIds !== undefined) continue;
      const standard = normalizedDefaults.zones.find(row => row.id === zone.id);
      if (!standard?.equipmentDropIds) continue;
      const candidates = [
        ...(zone.bonusItemId ? [zone.bonusItemId] : []),
        ...standard.equipmentDropIds.map(id => builtinItemIds.get(id) || id),
      ];
      const validCandidates = [...new Set(candidates)].filter(id =>
        result.items.some(item => item.id === id && item.category === 'gear')
      );
      if (validCandidates.length) zone.equipmentDropIds = validCandidates;
    }
    if (oldEquipment) {
      const shopDefaults = new Map(normalizedDefaults.shops.map(shop => [shop.nodeId, shop]));
      for (const shop of result.shops) {
        if (!['luna', 'forge'].includes(shop.nodeId)) continue;
        const standard = shopDefaults.get(shop.nodeId);
        if (!standard) continue;
        const additions = standard.itemIds
          .filter(
            id =>
              builtinIds.has(id) && ['uncommon'].includes(normalizedDefaults.items.find(item => item.id === id)?.rarity)
          )
          .map(id => builtinItemIds.get(id) || id);
        shop.itemIds = [...new Set([...shop.itemIds, ...additions])];
      }
    }
    const owner = (skill, rules) => skill.characterId ?? rules.party[0];
    for (const character of result.characters) {
      if (character.job !== undefined) continue;
      const standard = defaultCharacters.get(character.id);
      character.job = standard?.job || '冒険者';
      if (!standard?.job || !party.has(character.id)) continue;
      for (const fallback of normalizedDefaults.skills.filter(
        skill => owner(skill, normalizedDefaults.rules) === character.id
      )) {
        let id = fallback.id,
          existing = result.skills.find(skill => skill.id === id);
        if (existing && owner(existing, result.rules) === character.id) continue;
        if (existing) id = collisionId(id, new Set(result.skills.map(skill => skill.id)));
        const addition = JSON.parse(JSON.stringify(fallback));
        addition.id = id;
        addition.characterId = character.id;
        result.skills.push(addition);
      }
    }
    const resultErrors = validate(result);
    if (resultErrors.length) throw new Error(resultErrors.join('\n'));
    return result;
  }
  function legacy(data) {
    data = normalizeEquipmentRarities(data);
    const errors = validate(data);
    if (errors.length) throw new Error(errors.join('\n'));
    const dict = rows => Object.fromEntries(rows.map(e => [e.id, { ...e }]));
    const zoneIndex = id => data.zones.findIndex(z => z.id === id);
    return {
      zones: data.zones,
      gear: dict(data.items.filter(e => e.category === 'gear')),
      consumables: dict(data.items.filter(e => e.category === 'consumable')),
      shopStock: Object.fromEntries(data.shops.map(e => [e.nodeId, e.itemIds])),
      skillList: data.skills,
      mapNodes: data.nodes.map(e => ({ ...e, zone: zoneIndex(e.zoneId) })),
      rarities: dict(data.rarities),
      materials: dict(data.materials),
      bestiary: data.zones.map(z => data.monsters.filter(e => e.zoneId === z.id && !e.boss)),
      normalAttack: data.rules.normalAttack,
    };
  }
  return {
    validate,
    legacy,
    withJobs,
    categories,
    effectTypes,
    debuffEffectTypes,
    equipmentRarities,
    bonusEffectStats,
  };
});
