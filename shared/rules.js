(function (root, factory) {
  const api = factory();
  if (typeof module === 'object') module.exports = api;
  else root.GameRules = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, () => {
  'use strict';
  const characterDefaults = {
    rina: {
      baseHP: 64,
      hpPerLevel: 14,
      baseMP: 24,
      mpPerLevel: 5,
      baseAttack: 12,
      attackPerLevel: 3,
      baseDefense: 6,
      defensePerLevel: 2,
      baseWisdom: 14,
      wisdomPerLevel: 5,
      baseLuck: 14,
      luckPerLevel: 3,
    },
    gald: {
      baseHP: 100,
      hpPerLevel: 20,
      baseMP: 12,
      mpPerLevel: 2,
      baseAttack: 18,
      attackPerLevel: 5,
      baseDefense: 12,
      defensePerLevel: 3,
      baseWisdom: 6,
      wisdomPerLevel: 2,
      baseLuck: 8,
      luckPerLevel: 1,
    },
    noel: {
      baseHP: 68,
      hpPerLevel: 14,
      baseMP: 32,
      mpPerLevel: 6,
      baseAttack: 10,
      attackPerLevel: 3,
      baseDefense: 7,
      defensePerLevel: 2,
      baseWisdom: 18,
      wisdomPerLevel: 6,
      baseLuck: 12,
      luckPerLevel: 2,
    },
  };
  function memberState(state, data, index = 0) {
    if (index === 0) return state;
    const members = state.companions || [],
      identified = members.some(a => a?.characterId);
    return (
      members.find(a => a?.characterId === data.rules.party[index]) || (!identified ? members[index - 1] : null) || {}
    );
  }
  function stats(state, data, index = 0) {
    const character = data.characters.find(c => c.id === data.rules.party[index]);
    const g = { ...data.rules.growth, ...characterDefaults[character?.id], ...character?.stats },
      level = state.lv - 1,
      member = memberState(state, data, index);
    const weapon = memberGear(state, data, index, 'weapon'),
      armor = memberGear(state, data, index, 'armor');
    const result = {
      maxHP: g.baseHP + level * g.hpPerLevel,
      maxMP: g.baseMP + level * g.mpPerLevel,
      attack: g.baseAttack + level * g.attackPerLevel + (weapon?.value || 0),
      defense: g.baseDefense + level * g.defensePerLevel + (armor?.value || 0),
      wisdom: g.baseWisdom + level * g.wisdomPerLevel,
      luck: (g.baseLuck ?? 10) + level * (g.luckPerLevel ?? 2),
      speed: (character?.speed ?? 0) + level,
      threshold: data.rules.growth.baseExperience + state.lv * data.rules.growth.experiencePerLevel,
    };
    for (const item of [weapon, armor])
      for (const effect of item?.bonusEffects || [])
        if (Object.hasOwn(result, effect.stat)) result[effect.stat] += effect.amount;
    return result;
  }
  function skillOwnerId(skill, data) {
    return skill?.characterId ?? data?.rules?.party?.[0] ?? null;
  }
  function skillOwnerIndex(skill, data) {
    return data?.rules?.party?.indexOf(skillOwnerId(skill, data)) ?? -1;
  }
  function skillsForCharacter(data, characterId) {
    return data.skills.filter(skill => skillOwnerId(skill, data) === characterId);
  }
  function enemy(data, zone, boss, rng = Math.random) {
    const area = data.zones[zone];
    const pool = data.monsters.filter(e => e.zoneId === area.id && !e.boss);
    const template = boss ? data.monsters.find(e => e.id === area.bossId) : pool[Math.floor(rng() * pool.length)];
    return { ...template, hp: template.hp, max: template.hp, boss: !!boss };
  }
  function loot(data, enemy, zone) {
    const template = data.monsters.find(e => e.id === enemy.id || e.name === enemy.name);
    const fallback = data.monsters.find(e => e.zoneId === data.zones[zone].id);
    return (template || fallback).drops.map(id => ({
      id,
      rate: data.rarities.find(r => r.id === data.materials.find(m => m.id === id).rarity).rate,
    }));
  }
  function effectAmount(effect, context, combat) {
    switch (effect.type) {
      case 'attackBuff':
      case 'attackDown':
      case 'defenseDown':
        return 0;
      case 'physicalDamage':
        return combat.physicalDamage({
          attack: context.attack,
          defense: context.defense,
          power: effect.power,
          roll: context.roll,
          critical: context.critical,
        });
      case 'magicDamage':
      case 'magicHeal':
        return combat.magicAmount(context.wisdom, effect);
      case 'restoreHP':
        return effect.full ? context.maxHP : effect.amount;
      case 'restoreMP':
        return effect.full ? context.maxMP : effect.amount;
      default:
        throw new Error('未対応の効果: ' + effect.type);
    }
  }
  function skillResult(skill, context, combat) {
    const eligible =
      skill.type === 'physical' &&
      skill.effect === 'damage' &&
      context.attack > 0 &&
      skill.effects.some(e => e.type === 'physicalDamage' && e.power > 0);
    const rate = eligible ? combat.criticalRate(context.luck) : 0;
    const critical = rate > 0 && (context.criticalRoll ?? Math.random()) < rate;
    return {
      amount: skill.effects.reduce(
        (total, effect) => total + effectAmount(effect, { ...context, critical }, combat),
        0
      ),
      critical,
    };
  }
  function skillAmount(skill, context, combat) {
    return skillResult(skill, context, combat).amount;
  }
  function allyHealth(state, data, index) {
    if (index === 0) return state.hp;
    const id = data.rules.party[index],
      members = state.companions || [],
      identified = members.some(a => a?.characterId);
    return (members.find(a => a?.characterId === id) || (!identified ? members[index - 1] : null))?.hp;
  }
  function attackBuffEffect(skill) {
    const effect = skill?.effects?.[0];
    return skill?.effect === 'buff' &&
      skill.effects?.length === 1 &&
      effect?.type === 'attackBuff' &&
      Number.isFinite(effect.multiplier) &&
      effect.multiplier > 1 &&
      effect.multiplier <= 3 &&
      Number.isSafeInteger(effect.turns) &&
      effect.turns >= 1 &&
      effect.turns <= 99
      ? effect
      : null;
  }
  function buffRecord(state, data, record) {
    if (!record || typeof record !== 'object' || Array.isArray(record)) return null;
    const index = data.rules.party.indexOf(record.characterId),
      skill = data.skills.find(s => s.id === record.skillId),
      effect = attackBuffEffect(skill);
    if (
      index < 0 ||
      !effect ||
      (record.skillId === skill?.id && skill?.target === 'self' && record.characterId !== skillOwnerId(skill, data)) ||
      !(allyHealth(state, data, index) > 0) ||
      !Number.isSafeInteger(record.remainingTurns) ||
      record.remainingTurns < 1 ||
      record.remainingTurns > effect.turns ||
      !Number.isSafeInteger(record.appliedTurn) ||
      record.appliedTurn < 1 ||
      record.appliedTurn > state.turn
    )
      return null;
    return { ...record, skill, effect };
  }
  function validateBuffs(state, data) {
    if (state.buffs === undefined) return [];
    if (!Array.isArray(state.buffs) || state.buffs.length > data.rules.party.length) return ['バフの配列が不正です'];
    const errors = [],
      seen = new Set();
    for (const record of state.buffs) {
      if (!state.enemy || !buffRecord(state, data, record) || seen.has(record?.characterId))
        errors.push('バフの対象・スキル・残りターン・付与ターンが不正です');
      seen.add(record?.characterId);
    }
    return errors;
  }
  function normalizeBuffs(state, data) {
    const seen = new Set();
    state.buffs =
      !state.enemy || !Array.isArray(state.buffs)
        ? []
        : state.buffs
            .slice(0, data.rules.party.length)
            .filter(record => {
              if (!buffRecord(state, data, record) || seen.has(record.characterId)) return false;
              seen.add(record.characterId);
              return true;
            })
            .map(({ characterId, skillId, remainingTurns, appliedTurn }) => ({
              characterId,
              skillId,
              remainingTurns,
              appliedTurn,
            }));
    return state.buffs;
  }
  function activeBuffs(state, data, index) {
    if (!state.enemy || !Number.isInteger(index) || index < 0 || index >= data.rules.party.length) return [];
    const id = data.rules.party[index],
      seen = new Set();
    return (Array.isArray(state.buffs) ? state.buffs : [])
      .filter(record => {
        if (record?.characterId !== id || !buffRecord(state, data, record) || seen.has('attackBuff')) return false;
        seen.add('attackBuff');
        return true;
      })
      .map(record => buffRecord(state, data, record));
  }
  function allyAttack(state, data, index) {
    const multiplier =
      activeBuffs(state, data, index).reduce((value, buff) => value * buff.effect.multiplier, 1) *
      debuffMultiplier(state, data, 'ally', data.rules.party[index], 'attackDown');
    return Math.floor(stats(state, data, index).attack * multiplier);
  }
  function applyAttackBuff(state, data, index, skill, casterIndex = skillOwnerIndex(skill, data)) {
    const known = data.skills.find(s => s.id === skill?.id),
      effect = attackBuffEffect(known);
    if (
      !state.enemy ||
      !effect ||
      !Number.isInteger(index) ||
      index < 0 ||
      index >= data.rules.party.length ||
      !Number.isInteger(casterIndex) ||
      casterIndex < 0 ||
      casterIndex >= data.rules.party.length ||
      data.rules.party[casterIndex] !== skillOwnerId(known, data) ||
      (known.target === 'self' && index !== casterIndex) ||
      !(allyHealth(state, data, index) > 0) ||
      !Number.isSafeInteger(state.turn) ||
      state.turn < 1
    )
      return false;
    normalizeBuffs(state, data);
    const characterId = data.rules.party[index];
    state.buffs = state.buffs.filter(record => record.characterId !== characterId);
    state.buffs.push({ characterId, skillId: known.id, remainingTurns: effect.turns, appliedTurn: state.turn });
    return true;
  }
  function tickBuffs(state, data) {
    normalizeBuffs(state, data);
    const expired = [];
    for (const record of state.buffs) {
      if (record.appliedTurn >= state.turn) continue;
      record.remainingTurns--;
      if (record.remainingTurns === 0) {
        const skill = data.skills.find(s => s.id === record.skillId);
        expired.push({ ...record, skill, effect: attackBuffEffect(skill) });
      }
    }
    state.buffs = state.buffs.filter(record => record.remainingTurns > 0);
    return expired;
  }
  // 状態異常（攻撃ダウン・守備ダウン）。味方は characterId、敵は state.enemies の添字で対象を記録する。
  const debuffTypes = ['attackDown', 'defenseDown'];
  const debuffMin = 0.3;
  function debuffEffect(effect) {
    return effect &&
      debuffTypes.includes(effect.type) &&
      Number.isFinite(effect.multiplier) &&
      effect.multiplier >= debuffMin &&
      effect.multiplier < 1 &&
      Number.isSafeInteger(effect.turns) &&
      effect.turns >= 1 &&
      effect.turns <= 99
      ? effect
      : null;
  }
  function debuffSkillEffect(skill) {
    return skill?.effect === 'debuff' && skill.effects?.length === 1 ? debuffEffect(skill.effects[0]) : null;
  }
  function enemyActions(enemy) {
    return (Array.isArray(enemy?.actions) ? enemy.actions : []).filter(
      action =>
        action &&
        typeof action.name === 'string' &&
        action.name.trim() &&
        Number.isFinite(action.rate) &&
        action.rate > 0 &&
        action.rate <= 1 &&
        ['ally', 'allAllies'].includes(action.target) &&
        action.effects?.length === 1 &&
        debuffEffect(action.effects[0])
    );
  }
  // 強攻撃のターンは必ず通常攻撃。それ以外は定義順に確率で抽選し、最初に当たった行動を使う。
  function chooseEnemyAction(state, data, enemy, rng = Math.random) {
    if (state.turn % data.rules.battle.strongEvery === 0) return null;
    for (const action of enemyActions(enemy)) if (rng() < action.rate) return action;
    return null;
  }
  function battleEnemyList(state) {
    return Array.isArray(state.enemies) && state.enemies.length ? state.enemies : state.enemy ? [state.enemy] : [];
  }
  function debuffTargetAlive(state, data, side, target) {
    if (side === 'ally') {
      const index = data.rules.party.indexOf(target);
      return index >= 0 && allyHealth(state, data, index) > 0;
    }
    return Number.isSafeInteger(target) && target >= 0 && battleEnemyList(state)[target]?.hp > 0;
  }
  function debuffRecord(state, data, record) {
    if (!record || typeof record !== 'object' || Array.isArray(record)) return null;
    if (
      !['ally', 'enemy'].includes(record.side) ||
      !debuffTypes.includes(record.type) ||
      !debuffTargetAlive(state, data, record.side, record.target) ||
      typeof record.sourceId !== 'string' ||
      !record.sourceId ||
      record.sourceId.length > 64 ||
      !Number.isFinite(record.multiplier) ||
      record.multiplier < debuffMin ||
      record.multiplier >= 1 ||
      !Number.isSafeInteger(record.remainingTurns) ||
      record.remainingTurns < 1 ||
      record.remainingTurns > 99 ||
      !Number.isSafeInteger(record.appliedTurn) ||
      record.appliedTurn < 1 ||
      record.appliedTurn > state.turn
    )
      return null;
    const { side, target, type, sourceId, multiplier, remainingTurns, appliedTurn } = record;
    return { side, target, type, sourceId, multiplier, remainingTurns, appliedTurn };
  }
  const debuffKey = record => record.side + ':' + record.target + ':' + record.type;
  function debuffLimit(state, data) {
    return (data.rules.party.length + battleEnemyList(state).length) * debuffTypes.length;
  }
  function validateDebuffs(state, data) {
    if (state.debuffs === undefined) return [];
    if (!Array.isArray(state.debuffs) || state.debuffs.length > debuffLimit(state, data))
      return ['状態異常の配列が不正です'];
    const errors = [],
      seen = new Set();
    for (const record of state.debuffs) {
      const valid = state.enemy ? debuffRecord(state, data, record) : null;
      if (!valid || seen.has(debuffKey(valid))) errors.push('状態異常の対象・種類・倍率・残りターンが不正です');
      if (valid) seen.add(debuffKey(valid));
    }
    return errors;
  }
  function normalizeDebuffs(state, data) {
    const seen = new Set();
    state.debuffs =
      !state.enemy || !Array.isArray(state.debuffs)
        ? []
        : state.debuffs
            .map(record => debuffRecord(state, data, record))
            .filter(record => {
              if (!record || seen.has(debuffKey(record))) return false;
              seen.add(debuffKey(record));
              return true;
            })
            .slice(0, debuffLimit(state, data));
    return state.debuffs;
  }
  function activeDebuffs(state, data, side, target) {
    if (!state.enemy || !Array.isArray(state.debuffs)) return [];
    const seen = new Set();
    return state.debuffs
      .map(record => (record?.side === side && record.target === target ? debuffRecord(state, data, record) : null))
      .filter(record => {
        if (!record || seen.has(record.type)) return false;
        seen.add(record.type);
        return true;
      })
      .sort((a, b) => debuffTypes.indexOf(a.type) - debuffTypes.indexOf(b.type));
  }
  function debuffMultiplier(state, data, side, target, type) {
    return activeDebuffs(state, data, side, target).find(record => record.type === type)?.multiplier ?? 1;
  }
  function allyDefense(state, data, index) {
    return Math.floor(
      stats(state, data, index).defense * debuffMultiplier(state, data, 'ally', data.rules.party[index], 'defenseDown')
    );
  }
  function enemyAttack(state, data, index) {
    return Math.floor(
      Math.max(0, battleEnemyList(state)[index]?.atk || 0) * debuffMultiplier(state, data, 'enemy', index, 'attackDown')
    );
  }
  function enemyDefense(state, data, index) {
    return Math.floor(
      Math.max(0, battleEnemyList(state)[index]?.def || 0) *
        debuffMultiplier(state, data, 'enemy', index, 'defenseDown')
    );
  }
  // 同じ対象・種類は重ならず、付け直すと倍率と残りターンを更新する。
  function applyDebuff(state, data, side, target, effect, sourceId) {
    const valid = debuffEffect(effect);
    if (
      !state.enemy ||
      !valid ||
      !['ally', 'enemy'].includes(side) ||
      !debuffTargetAlive(state, data, side, target) ||
      typeof sourceId !== 'string' ||
      !sourceId ||
      !Number.isSafeInteger(state.turn) ||
      state.turn < 1
    )
      return false;
    normalizeDebuffs(state, data);
    state.debuffs = state.debuffs.filter(
      record => !(record.side === side && record.target === target && record.type === valid.type)
    );
    state.debuffs.push({
      side,
      target,
      type: valid.type,
      sourceId: sourceId.slice(0, 64),
      multiplier: valid.multiplier,
      remainingTurns: valid.turns,
      appliedTurn: state.turn,
    });
    return true;
  }
  function tickDebuffs(state, data) {
    normalizeDebuffs(state, data);
    const expired = [];
    for (const record of state.debuffs) {
      if (record.appliedTurn >= state.turn) continue;
      record.remainingTurns--;
      if (record.remainingTurns === 0) expired.push({ ...record });
    }
    state.debuffs = state.debuffs.filter(record => record.remainingTurns > 0);
    return expired;
  }
  function gearLevel(item) {
    return Number.isSafeInteger(item?.level) && item.level >= 1 ? item.level : 1;
  }
  function canEquip(level, item) {
    return !!item && Number(level) >= gearLevel(item);
  }
  // 装備の個体。セーブの gear が所持品の正本で、owned・weapon・armor は装備IDの写し。
  const gearSlots = ['weapon', 'armor'],
    gearRarityIds = ['common', 'uncommon', 'rare', 'epic', 'legendary'],
    gearStorageLimit = 30;
  function gearBase(data, id) {
    return data.items.find(item => item.id === id && item.category === 'gear') || null;
  }
  function standardGear(base) {
    return {
      rarity: gearRarityIds.includes(base.rarity) ? base.rarity : 'common',
      bonusEffects: (base.bonusEffects || []).map(effect => ({ stat: effect.stat, amount: effect.amount })),
    };
  }
  function gearItem(data, instance) {
    const base = gearBase(data, instance?.baseId);
    if (!base) return null;
    return {
      ...base,
      uid: instance.uid,
      rarity: instance.rarity,
      bonusEffects: instance.bonusEffects.map(effect => ({ ...effect })),
    };
  }
  // 仲間の記録がまだない間（読み込み直後など）は主人公だけを扱う。
  function partyMembers(state, data) {
    const companions = Array.isArray(state.companions) ? state.companions : [];
    return [
      state,
      ...data.rules.party
        .slice(1)
        .map((_, i) => memberState(state, data, i + 1))
        .filter(member => companions.includes(member)),
    ];
  }
  // ドロップ時の抽選。固有装備と抽選ルールのない定義では、常に標準品になる。
  const gearEffectCounts = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4 };
  function gearRollable(data, base) {
    return !!data.rules?.gearRoll && !!base && base.unique !== true;
  }
  function gearAmountRange(data, base, rarity, stat) {
    const roll = data.rules.gearRoll,
      rate = roll.statRates[stat],
      [low, high] = roll.rarityRanges[rarity] || [0, 0],
      level = gearLevel(base);
    return [Math.max(1, Math.round(rate * level * low)), Math.max(1, Math.round(rate * level * high))];
  }
  function rollGear(data, baseId, rng = Math.random) {
    const base = gearBase(data, baseId);
    if (!base) return null;
    if (!gearRollable(data, base)) return standardGear(base);
    const roll = data.rules.gearRoll,
      pick = rng();
    let total = 0,
      rarity = 'common';
    for (const id of gearRarityIds) {
      // 0.5+0.3+0.125+0.05 が 0.9750000000000001 になるような浮動小数点の誤差を、境界の判定から除く。
      total = Math.round((total + roll.rarityRates[id]) * 1e9) / 1e9;
      if (pick < total) {
        rarity = id;
        break;
      }
    }
    const pool = Object.keys(roll.statRates),
      bonusEffects = [];
    for (let i = 0; i < gearEffectCounts[rarity] && pool.length; i++) {
      const stat = pool.splice(Math.min(pool.length - 1, Math.floor(rng() * pool.length)), 1)[0],
        [low, high] = roll.rarityRanges[rarity],
        rate = roll.statRates[stat];
      bonusEffects.push({
        stat,
        amount: Math.max(1, Math.round(rate * gearLevel(base) * (low + (high - low) * rng()))),
      });
    }
    return { rarity, bonusEffects };
  }
  // 標準品と同じ値か、抽選ルールの範囲内の値なら有効。
  function gearInstanceValid(data, instance) {
    if (!instance || typeof instance !== 'object' || !Number.isSafeInteger(instance.uid) || instance.uid < 1)
      return false;
    const base = gearBase(data, instance.baseId);
    if (!base || !Array.isArray(instance.bonusEffects)) return false;
    const standard = standardGear(base);
    if (
      instance.rarity === standard.rarity &&
      JSON.stringify(standard.bonusEffects) ===
        JSON.stringify(instance.bonusEffects.map(effect => ({ stat: effect?.stat, amount: effect?.amount })))
    )
      return true;
    if (!gearRollable(data, base) || !gearRarityIds.includes(instance.rarity)) return false;
    if (instance.bonusEffects.length !== gearEffectCounts[instance.rarity]) return false;
    const seen = new Set();
    return instance.bonusEffects.every(effect => {
      if (!effect || !Object.hasOwn(data.rules.gearRoll.statRates, effect.stat) || seen.has(effect.stat)) return false;
      seen.add(effect.stat);
      const [low, high] = gearAmountRange(data, base, instance.rarity, effect.stat);
      return Number.isSafeInteger(effect.amount) && effect.amount >= low && effect.amount <= high;
    });
  }
  // 抽選ルールの変更に合わせて個体を直す（読み込み時）。旧4段階のレジェンダリー（追加効果3つ）はエピックにし、
  // 形が正しい抽選品の数値は今の範囲へ収める。範囲外の値は標準品に戻さず、最も近い範囲内の値にする。
  function migrateGearInstance(data, instance) {
    const base = gearBase(data, instance.baseId);
    if (!gearRollable(data, base) || !Array.isArray(instance.bonusEffects)) return;
    const standard = standardGear(base);
    if (
      instance.rarity === standard.rarity &&
      JSON.stringify(standard.bonusEffects) ===
        JSON.stringify(instance.bonusEffects.map(effect => ({ stat: effect?.stat, amount: effect?.amount })))
    )
      return;
    if (instance.rarity === 'legendary' && instance.bonusEffects.length === gearEffectCounts.epic)
      instance.rarity = 'epic';
    if (!gearRarityIds.includes(instance.rarity) || instance.bonusEffects.length !== gearEffectCounts[instance.rarity])
      return;
    const stats = instance.bonusEffects.map(effect => effect?.stat);
    if (
      new Set(stats).size !== stats.length ||
      stats.some(stat => !Object.hasOwn(data.rules.gearRoll.statRates, stat)) ||
      instance.bonusEffects.some(effect => !Number.isSafeInteger(effect.amount))
    )
      return;
    instance.bonusEffects = instance.bonusEffects.map(effect => {
      const [low, high] = gearAmountRange(data, base, instance.rarity, effect.stat);
      return { stat: effect.stat, amount: Math.min(high, Math.max(low, effect.amount)) };
    });
  }
  function memberGear(state, data, index, slot) {
    const member = memberState(state, data, index),
      mirror = member[slot] ?? state[slot];
    if (Array.isArray(state.gear)) {
      // 写しが書き換えられていれば写しを優先する（normalizeGear と同じ結果）。
      const instance = state.gear.find(e => e?.uid === member[slot + 'Uid']);
      if (instance && (instance.baseId === mirror || gearBase(data, mirror)?.type !== slot))
        return gearItem(data, instance);
    }
    const base = gearBase(data, mirror);
    return base ? { ...base, ...standardGear(base) } : null;
  }
  function equippedGearUids(state, data) {
    const uids = new Set();
    for (const member of partyMembers(state, data))
      for (const slot of gearSlots) if (member[slot + 'Uid'] !== undefined) uids.add(member[slot + 'Uid']);
    return uids;
  }
  function storedGearCount(state, data) {
    const equipped = equippedGearUids(state, data);
    return (state.gear || []).filter(e => !equipped.has(e.uid)).length;
  }
  // rng を渡すとドロップとして抽選し、省略すると標準品（ショップ品など）を加える。
  function addGear(state, data, baseId, rng = null) {
    const base = gearBase(data, baseId);
    if (!base) return null;
    const instance = { uid: state.nextGearUid, baseId, ...(rng ? rollGear(data, baseId, rng) : standardGear(base)) };
    state.nextGearUid += 1;
    state.gear.push(instance);
    return instance;
  }
  function syncGearMirrors(state, data) {
    const byUid = new Map(state.gear.map(e => [e.uid, e]));
    for (const member of partyMembers(state, data))
      for (const slot of gearSlots) {
        const instance = byUid.get(member[slot + 'Uid']);
        if (instance) member[slot] = instance.baseId;
      }
    state.owned = [...new Set(state.gear.map(e => e.baseId))];
  }
  // 旧セーブの移行と壊れた個体の修復。何度呼んでも同じ結果になる。
  // 写し（owned・weapon・armor）が以前の版などで書き換えられていたら、その内容を個体へ取り込む。
  function normalizeGear(state, data) {
    const members = partyMembers(state, data),
      seen = new Set();
    if (!Array.isArray(state.gear)) state.gear = [];
    state.gear = state.gear.filter(e => {
      if (!e || !Number.isSafeInteger(e.uid) || e.uid < 1 || seen.has(e.uid) || !gearBase(data, e.baseId)) return false;
      seen.add(e.uid);
      return true;
    });
    for (const instance of state.gear) migrateGearInstance(data, instance);
    for (const instance of state.gear)
      if (!gearInstanceValid(data, instance)) Object.assign(instance, standardGear(gearBase(data, instance.baseId)));
    const maxUid = state.gear.reduce((max, e) => Math.max(max, e.uid), 0);
    if (!Number.isSafeInteger(state.nextGearUid) || state.nextGearUid <= maxUid) state.nextGearUid = maxUid + 1;
    const byUid = new Map(state.gear.map(e => [e.uid, e])),
      slots = members.flatMap(member =>
        gearSlots.map(slot => {
          const current = byUid.get(member[slot + 'Uid']),
            mirror = member === state || member[slot] !== undefined ? member[slot] : state[slot],
            desired =
              gearBase(data, mirror)?.type === slot
                ? mirror
                : current && gearBase(data, current.baseId).type === slot
                  ? current.baseId
                  : [state[slot], 'twig', 'cloth', ...data.items.map(e => e.id)].find(
                      id => gearBase(data, id)?.type === slot
                    );
          return { member, slot, current, desired };
        })
      ),
      used = new Set();
    for (const entry of slots)
      if (entry.current?.baseId === entry.desired && !used.has(entry.current.uid)) {
        used.add(entry.current.uid);
        entry.done = true;
      }
    for (const entry of slots) {
      if (entry.done) continue;
      const instance =
        state.gear.find(e => e.baseId === entry.desired && !used.has(e.uid)) || addGear(state, data, entry.desired);
      if (!instance) continue;
      used.add(instance.uid);
      entry.member[entry.slot + 'Uid'] = instance.uid;
    }
    const represented = new Set(state.gear.map(e => e.baseId));
    for (const id of Array.isArray(state.owned) ? state.owned : [])
      if (!represented.has(id) && gearBase(data, id)) {
        represented.add(id);
        addGear(state, data, id);
      }
    syncGearMirrors(state, data);
    return state;
  }
  function validateGear(state, data) {
    if (state.gear === undefined) return [];
    if (!Array.isArray(state.gear)) return ['装備の個体が不正です'];
    const errors = [],
      byUid = new Map();
    for (const instance of state.gear) {
      if (!gearInstanceValid(data, instance) || byUid.has(instance.uid)) errors.push('装備の個体が不正です');
      else byUid.set(instance.uid, instance);
    }
    if (errors.length) return errors;
    const maxUid = Math.max(0, ...byUid.keys());
    if (!Number.isSafeInteger(state.nextGearUid) || state.nextGearUid <= maxUid)
      errors.push('装備の通し番号が不正です');
    const worn = new Set();
    const members = [state, ...(Array.isArray(state.companions) ? state.companions : [])];
    for (const member of members)
      for (const slot of gearSlots) {
        const instance = byUid.get(member?.[slot + 'Uid']);
        if (!instance || gearBase(data, instance.baseId).type !== slot || worn.has(instance.uid))
          errors.push('装着中の装備が不正です');
        else worn.add(instance.uid);
      }
    if (state.gear.length - worn.size > gearStorageLimit) errors.push('装備の所持数が上限を超えています');
    return errors;
  }
  // 売却額：基準額（ショップ価格の半分、非売品は装備Lv×10）にレアリティの倍率を掛ける。
  const gearSellMultipliers = { common: 1, uncommon: 1.5, rare: 2.5, epic: 3.5, legendary: 5 };
  function gearSellPrice(item) {
    const base = item?.price > 0 ? Math.floor(item.price / 2) : gearLevel(item) * 10;
    return Math.floor(base * (gearSellMultipliers[item?.rarity] ?? 1));
  }
  // 装着していない個体だけを売れる。街にいるかどうかは呼び出し側で確かめる。
  function sellGear(state, data, uid) {
    const instance = Array.isArray(state.gear) ? state.gear.find(e => e.uid === uid) : null,
      item = instance ? gearItem(data, instance) : null;
    if (!item) return { ok: false, reason: 'missing' };
    if (equippedGearUids(state, data).has(uid)) return { ok: false, reason: 'equipped', item };
    const price = gearSellPrice(item);
    state.gear = state.gear.filter(e => e.uid !== uid);
    state.gold += price;
    syncGearMirrors(state, data);
    return { ok: true, item, price };
  }
  // 装着した場合の能力の加算分（基礎補正と追加効果）。
  function gearContribution(item) {
    const result = {};
    if (!item) return result;
    result[item.type === 'weapon' ? 'attack' : 'defense'] = item.value || 0;
    for (const effect of item.bonusEffects || []) result[effect.stat] = (result[effect.stat] || 0) + effect.amount;
    return result;
  }
  // 装備の付け替え。他の人物が着けている個体なら、互いの装備を交換する。
  function equipGear(state, data, index, uid) {
    const instance = Array.isArray(state.gear) ? state.gear.find(e => e.uid === uid) : null,
      base = gearBase(data, instance?.baseId);
    if (!base) return { ok: false, reason: 'missing' };
    const slot = base.type,
      key = slot + 'Uid',
      members = partyMembers(state, data),
      member = members[index];
    if (!member) return { ok: false, reason: 'missing' };
    if (member[key] === uid) return { ok: false, reason: 'equipped' };
    if (!canEquip(state.lv, base)) return { ok: false, reason: 'level', item: base };
    const otherIndex = members.findIndex(e => e[key] === uid);
    if (otherIndex >= 0) {
      const swapped = state.gear.find(e => e.uid === member[key]),
        swappedBase = gearBase(data, swapped?.baseId);
      if (!canEquip(state.lv, swappedBase)) return { ok: false, reason: 'swap-level', item: swappedBase, otherIndex };
      members[otherIndex][key] = member[key];
    }
    member[key] = uid;
    syncGearMirrors(state, data);
    return { ok: true, item: base, otherIndex };
  }
  function travelEvent(rules, fought, roll) {
    if (!fought && roll < rules.battleRate) return 'battle';
    if (roll < (fought ? rules.materialRate : rules.battleRate + rules.materialRate)) return 'material';
    return 'none';
  }
  return {
    characterDefaults,
    memberState,
    stats,
    skillOwnerId,
    skillOwnerIndex,
    skillsForCharacter,
    enemy,
    loot,
    effectAmount,
    skillResult,
    skillAmount,
    travelEvent,
    gearLevel,
    canEquip,
    gearStorageLimit,
    gearItem,
    memberGear,
    storedGearCount,
    addGear,
    rollGear,
    gearAmountRange,
    normalizeGear,
    validateGear,
    equipGear,
    gearSellPrice,
    sellGear,
    gearContribution,
    activeBuffs,
    allyAttack,
    applyAttackBuff,
    tickBuffs,
    normalizeBuffs,
    validateBuffs,
    debuffTypes,
    debuffEffect,
    debuffSkillEffect,
    enemyActions,
    chooseEnemyAction,
    activeDebuffs,
    debuffMultiplier,
    allyDefense,
    enemyAttack,
    enemyDefense,
    applyDebuff,
    tickDebuffs,
    normalizeDebuffs,
    validateDebuffs,
  };
});
