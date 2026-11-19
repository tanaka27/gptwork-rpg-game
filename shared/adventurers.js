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
    firstNames = [
      { name: 'アレン', gender: '男性' },
      { name: 'セリア', gender: '女性' },
      { name: 'ラルフ', gender: '男性' },
      { name: 'ミーナ', gender: '女性' },
      { name: 'カイル', gender: '男性' },
      { name: 'エリス', gender: '女性' },
      { name: 'ノエラ', gender: '女性' },
      { name: 'ガイ', gender: '男性' },
      { name: 'フィーナ', gender: '女性' },
      { name: 'ルーク', gender: '男性' },
    ],
    // 既存の generated illustration をID順に見た目から推定した年齢。新しい画像を追加するときは対応する値も追加する。
    portraitAges = [
      24, 23, 31, 22, 42, 25, 34, 28, 25, 30, 44, 27, 23, 30, 22, 32, 21, 36, 24, 48, 29, 22, 38, 33, 46, 30, 31, 66,
      28, 29, 29, 24, 32, 31, 43, 21, 67, 36, 38, 32, 35, 42, 28, 30, 42, 29, 34, 25, 38, 54, 45, 25, 27, 35, 62, 30,
      34, 37, 25, 39, 64, 49, 27, 34, 40, 52, 34, 39, 26, 33, 31, 19, 53, 33, 64, 41, 36, 35, 27, 50, 23, 52, 22, 34,
      68, 30, 40, 34, 32, 25, 28, 33, 26, 36, 30, 29, 47, 39, 51, 42,
    ],
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
      name: firstNames[index % firstNames.length].name + '・' + familyNames[Math.floor(index / firstNames.length)],
      age: portraitAges[index],
      gender: firstNames[index % firstNames.length].gender,
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

  function validateRoster() {
    const errors = [],
      genders = new Set(['男性', '女性', 'その他', '未設定']);
    if (roster.length !== COUNT || portraitAges.length !== COUNT)
      errors.push('冒険者名簿と画像年齢の件数が一致しません');
    for (const adventurer of roster) {
      if (!Number.isSafeInteger(adventurer.age) || adventurer.age < 0 || adventurer.age > 120)
        errors.push(adventurer.id + ': 年齢が不正です');
      if (!genders.has(adventurer.gender)) errors.push(adventurer.id + ': 性別が不正です');
    }
    return errors;
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
    validateRoster,
    initialState,
    validate,
    recover,
    advanceTick,
    recordExploration,
  };
});
