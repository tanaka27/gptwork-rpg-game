const assert = require('node:assert/strict');
const AdventurerRules = require('../shared/adventurers.js');
const SaveRules = require('../shared/save.js');
const content = require('../content/game.json');

const roster = AdventurerRules.list();
assert.equal(roster.length, 100);
assert.equal(new Set(roster.map(adventurer => adventurer.id)).size, 100);
assert.equal(new Set(roster.map(adventurer => adventurer.name)).size, 100);
for (const adventurer of roster) {
  assert.match(adventurer.id, /^adventurer_\d{3}$/);
  assert.ok(adventurer.name && adventurer.job);
  for (const field of ['level', 'hp', 'mp', 'attack', 'defense', 'wisdom', 'luck', 'speed']) {
    assert.ok(Number.isSafeInteger(adventurer[field]) && adventurer[field] > 0, `${adventurer.id}.${field}`);
  }
}

const initial = AdventurerRules.initialState(content.nodes),
  nodeIds = new Set(content.nodes.map(node => node.id)),
  startCounts = Object.values(initial.locations).reduce((counts, nodeId) => {
    counts[nodeId] = (counts[nodeId] || 0) + 1;
    return counts;
  }, {});
assert.deepEqual(startCounts, { home: 34, luna: 33, forge: 33 });
assert.deepEqual(AdventurerRules.validate(initial, content.nodes), []);

const firstTick = AdventurerRules.advanceTick(initial, content.nodes),
  repeatedTick = AdventurerRules.advanceTick(initial, content.nodes),
  mapById = new Map(content.nodes.map(node => [node.id, node]));
assert.deepEqual(firstTick, repeatedTick, 'the same saved random state produces the same tick');
assert.equal(firstTick.tick, 1);
assert.notEqual(firstTick.rngState, initial.rngState);
let moved = 0,
  stayed = 0;
for (const adventurer of roster) {
  const before = initial.locations[adventurer.id],
    after = firstTick.locations[adventurer.id];
  assert.ok(nodeIds.has(after), `${adventurer.id} remains on a known map node`);
  if (before === after) stayed++;
  else {
    moved++;
    assert.ok(mapById.get(before).links.includes(after), `${adventurer.id} moves only to a neighbor`);
  }
}
assert.ok(moved > 0 && stayed > 0, 'the fixed seed exercises both movement and staying');
assert.deepEqual(initial, AdventurerRules.initialState(content.nodes), 'a tick does not mutate its source state');

let exploration = initial;
exploration = AdventurerRules.recordExploration(exploration, content.nodes);
exploration = AdventurerRules.recordExploration(exploration, content.nodes);
assert.equal(exploration.tick, 0);
assert.equal(exploration.explorationProgress, 2);
exploration = AdventurerRules.recordExploration(exploration, content.nodes);
assert.equal(exploration.tick, 1);
assert.equal(exploration.explorationProgress, 0);
const continued = AdventurerRules.recordExploration({ ...exploration, explorationProgress: 2 }, content.nodes);
assert.equal(continued.tick, 2, 'the exploration threshold remains independent from movement ticks');

const saved = {
  v: 2,
  lv: 1,
  xp: 0,
  hp: 80,
  mp: 20,
  gold: 30,
  turn: 1,
  total: 0,
  node: 'meadow',
  lastTown: 'home',
  weapon: 'twig',
  armor: 'cloth',
  owned: ['twig', 'cloth'],
  items: { herb: 3, ether: 1, potion: 0 },
  materials: {},
  kills: [0, 0, 0],
  cleared: [false, false, false],
  log: [],
  adventurerState: firstTick,
};
assert.deepEqual(SaveRules.validate(saved, content), []);
const legacySave = { ...saved };
delete legacySave.adventurerState;
assert.deepEqual(SaveRules.validate(legacySave, content), [], 'v:2 saves without NPC state remain valid');
assert.deepEqual(AdventurerRules.recover(undefined, content.nodes), initial);
const corrupt = { ...firstTick, locations: { ...firstTick.locations, adventurer_001: 'missing' } },
  repaired = AdventurerRules.recover(corrupt, content.nodes);
assert.deepEqual(repaired, initial, 'a broken NPC state recovers independently to deterministic defaults');
assert.ok(SaveRules.validate({ ...saved, adventurerState: corrupt }, content).some(error => error.includes('冒険者の位置')));

console.log('PASS: fixed 100-person roster, independent stats, town distribution, deterministic adjacent ticks, exploration threshold, v:2 save validation and repair');
