(function (root, factory) {
  const api = factory();
  if (typeof module === 'object') module.exports = api;
  else root.QuestRules = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, () => {
  'use strict';

  const catalog = [
    {
      id: 'village_bounty',
      name: '村長の討伐依頼',
      condition: '魔物を累計5体倒す',
      target: 5,
      mode: 'lifetime',
      gold: 100,
      items: { potion: 2 },
    },
    {
      id: 'apprentice_hunt',
      name: '見習い討伐依頼',
      condition: '受注後に魔物を3体倒す',
      target: 3,
      mode: 'afterAcceptance',
      gold: 35,
      items: {},
    },
    {
      id: 'veteran_hunt',
      name: '熟練討伐依頼',
      condition: '受注後に魔物を8体倒す',
      target: 8,
      mode: 'afterAcceptance',
      gold: 90,
      items: { potion: 1 },
    },
  ];
  const byId = new Map(catalog.map(quest => [quest.id, quest]));
  const legacyId = 'village_bounty';
  const isRecord = value => !!value && typeof value === 'object' && !Array.isArray(value);
  const isInteger = value => Number.isSafeInteger(value) && value >= 0;

  function list() {
    return catalog.map(quest => ({ ...quest, items: { ...quest.items } }));
  }

  function get(id) {
    const quest = byId.get(id);
    return quest ? { ...quest, items: { ...quest.items } } : null;
  }

  function initialState(claimed = false) {
    return { active: null, completedIds: claimed ? [legacyId] : [] };
  }

  function recover(state, total, claimed) {
    const completedIds = Array.isArray(state?.completedIds)
      ? [...new Set(state.completedIds.filter(id => byId.has(id)))]
      : [];
    let receivedLegacyReward = claimed === true || completedIds.includes(legacyId);
    if (receivedLegacyReward && !completedIds.includes(legacyId)) completedIds.push(legacyId);
    let active = state?.active;
    if (
      !isRecord(active) ||
      !byId.has(active.id) ||
      completedIds.includes(active.id) ||
      !isInteger(active.acceptedAtTotal) ||
      !isInteger(total) ||
      active.acceptedAtTotal > total
    )
      active = null;
    return {
      state: { active: active ? { id: active.id, acceptedAtTotal: active.acceptedAtTotal } : null, completedIds },
      claimed: receivedLegacyReward,
    };
  }

  function validate(state, total, claimed) {
    const errors = [];
    if (!isRecord(state)) return ['依頼状態が不正です'];
    if (!Array.isArray(state.completedIds)) errors.push('完了した依頼一覧が不正です');
    const completed = Array.isArray(state.completedIds) ? state.completedIds : [];
    const seen = new Set();
    for (const id of completed) {
      if (!byId.has(id)) errors.push('不明な完了依頼です: ' + String(id));
      if (seen.has(id)) errors.push('完了依頼が重複しています: ' + String(id));
      seen.add(id);
    }
    if (state.active !== null) {
      if (!isRecord(state.active)) errors.push('受注中の依頼が不正です');
      else {
        if (!byId.has(state.active.id)) errors.push('不明な受注依頼です: ' + String(state.active.id));
        if (!isInteger(state.active.acceptedAtTotal) || state.active.acceptedAtTotal > total)
          errors.push('受注時の討伐数が不正です');
        if (seen.has(state.active.id)) errors.push('完了済みの依頼を受注しています');
      }
    }
    if (typeof claimed !== 'boolean') errors.push('旧報酬の受領状態が不正です');
    else if (claimed !== seen.has(legacyId)) errors.push('旧報酬と完了依頼の状態が一致しません');
    return errors;
  }

  function isCompleted(state, id) {
    return !!state && Array.isArray(state.completedIds) && state.completedIds.includes(id);
  }

  function supports(id, availableItems) {
    const quest = byId.get(id);
    if (!quest) return false;
    if (availableItems === undefined) return true;
    return Object.keys(quest.items).every(itemId => availableItems[itemId]?.category === 'consumable');
  }

  function progress(id, total, active) {
    const quest = byId.get(id);
    if (!quest || !isInteger(total)) return 0;
    if (quest.mode === 'lifetime') return Math.min(total, quest.target);
    if (active?.id !== id || !isInteger(active.acceptedAtTotal)) return 0;
    return Math.min(Math.max(0, total - active.acceptedAtTotal), quest.target);
  }

  function canAccept(state, id, total, claimed, availableItems) {
    return (
      !validate(state, total, claimed).length &&
      !state.active &&
      supports(id, availableItems) &&
      !isCompleted(state, id)
    );
  }

  function accept(state, id, total, claimed, availableItems) {
    if (!canAccept(state, id, total, claimed, availableItems)) return null;
    return { active: { id, acceptedAtTotal: total }, completedIds: [...state.completedIds] };
  }

  function canReport(state, total, claimed, availableItems) {
    if (validate(state, total, claimed).length || !state.active) return false;
    const quest = byId.get(state.active.id);
    return supports(quest?.id, availableItems) && progress(quest.id, total, state.active) >= quest.target;
  }

  function report(state, total, claimed, availableItems) {
    if (!canReport(state, total, claimed, availableItems)) return null;
    const quest = byId.get(state.active.id);
    return {
      quest: get(quest.id),
      state: { active: null, completedIds: [...state.completedIds, quest.id] },
    };
  }

  return {
    list,
    get,
    initialState,
    recover,
    validate,
    isCompleted,
    supports,
    progress,
    canAccept,
    accept,
    canReport,
    report,
  };
});
