(function (root, factory) {
  const api = factory();
  if (typeof module === 'object') module.exports = api;
  else root.AdventurerRules = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, () => {
  'use strict';

  const COUNT = 100,
    EXPLORE_THRESHOLD = 3,
    MOVE_RATE = 0.25,
    INITIAL_SEED = 0x74617631,
    firstNames = ['アレン', 'セリア', 'ラルフ', 'ミーナ', 'カイル', 'エリス', 'ノエラ', 'ガイ', 'フィーナ', 'ルーク'],
    familyNames = [
      'アルヴァ',
      'ベルン',
      'カーディス',
      'ドーン',
      'エルム',
      'フェルン',
      'グラン',
      'ハルツ',
      'イリス',
      'ジュノ',
    ],
    jobs = ['剣士', '魔法使い', '弓使い', '戦士', '僧侶', '盗賊', '騎士', '錬金術師', '旅芸人', '狩人'];

  const roster = Array.from({ length: COUNT }, (_, index) => {
    const jobIndex = index % jobs.length,
      level = 1 + ((index * 7 + 3) % 30);
    return Object.freeze({
      id: 'adventurer_' + String(index + 1).padStart(3, '0'),
      name: firstNames[index % firstNames.length] + '・' + familyNames[Math.floor(index / firstNames.length)],
      job: jobs[jobIndex],
      level,
      hp: 48 + jobIndex * 5 + level * 3 + (index % 7),
      mp: 6 + (jobIndex % 6) * 5 + Math.floor(level * 1.5) + ((index * 3) % 7),
      attack: 7 + (jobIndex % 5) * 3 + Math.floor(level * 1.2) + (index % 4),
      defense: 3 + (jobIndex % 4) * 3 + Math.floor(level / 4) + (index % 3),
      wisdom: 5 + ((jobIndex * 3) % 17) + Math.floor(level / 2) + (index % 5),
      luck: 4 + Math.floor(index / 20),
      speed: 5 + (index % 20),
    });
  });
  const rosterById = new Map(roster.map(adventurer => [adventurer.id, adventurer]));
  const isRecord = value => !!value && typeof value === 'object' && !Array.isArray(value);
  const validInteger = value => Number.isSafeInteger(value) && value >= 0;

  function list() {
    return [...roster];
  }

  function initialState(nodes) {
    const towns = nodes.filter(node => node.town).map(node => node.id),
      fallback = nodes[0]?.id,
      startingNodes = towns.length ? towns : fallback ? [fallback] : [];
    const locations = {};
    roster.forEach((adventurer, index) => {
      if (startingNodes.length) locations[adventurer.id] = startingNodes[index % startingNodes.length];
    });
    return { tick: 0, explorationProgress: 0, rngState: INITIAL_SEED, locations };
  }

  function validate(state, nodes) {
    const errors = [];
    if (!isRecord(state)) return ['冒険者の状態が不正です'];
    if (!validInteger(state.tick)) errors.push('冒険者のtickが不正です');
    if (
      !Number.isSafeInteger(state.explorationProgress) ||
      state.explorationProgress < 0 ||
      state.explorationProgress >= EXPLORE_THRESHOLD
    )
      errors.push('探索の進捗が不正です');
    if (!Number.isSafeInteger(state.rngState) || state.rngState < 0 || state.rngState > 0xffffffff)
      errors.push('冒険者の乱数状態が不正です');
    if (!isRecord(state.locations)) return [...errors, '冒険者の位置一覧が不正です'];
    const nodeIds = new Set(nodes.map(node => node.id)),
      ids = Object.keys(state.locations);
    if (ids.length !== roster.length) errors.push('冒険者の人数が不正です');
    for (const id of ids) {
      if (!rosterById.has(id)) errors.push('不明な冒険者IDです: ' + id);
      if (!nodeIds.has(state.locations[id])) errors.push('冒険者の位置が不正です: ' + id);
    }
    for (const adventurer of roster)
      if (!Object.hasOwn(state.locations, adventurer.id)) errors.push('冒険者の位置がありません: ' + adventurer.id);
    return errors;
  }

  function recover(state, nodes) {
    if (!validate(state, nodes).length) return { ...state, locations: { ...state.locations } };
    return initialState(nodes);
  }

  function nextRandom(state) {
    state.rngState = (state.rngState + 0x6d2b79f5) >>> 0;
    let value = state.rngState;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 0x100000000;
  }

  function advanceTick(state, nodes) {
    const next = { ...state, tick: state.tick + 1, locations: { ...state.locations } },
      nodeById = new Map(nodes.map(node => [node.id, node]));
    for (const adventurer of roster) {
      const current = nodeById.get(state.locations[adventurer.id]);
      if (!current || nextRandom(next) >= MOVE_RATE) continue;
      const neighbors = (current.links || [])
        .filter(id => nodeById.has(id))
        .slice()
        .sort();
      if (neighbors.length) next.locations[adventurer.id] = neighbors[Math.floor(nextRandom(next) * neighbors.length)];
    }
    return next;
  }

  function recordExploration(state, nodes) {
    const next = { ...state, locations: { ...state.locations }, explorationProgress: state.explorationProgress + 1 };
    if (next.explorationProgress < EXPLORE_THRESHOLD) return next;
    next.explorationProgress = 0;
    return advanceTick(next, nodes);
  }

  return {
    COUNT,
    EXPLORE_THRESHOLD,
    MOVE_RATE,
    list,
    initialState,
    validate,
    recover,
    advanceTick,
    recordExploration,
  };
});
