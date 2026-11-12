const assert = require('node:assert/strict');
const { boot } = require('./boot.cjs');

const app = boot();
const initial = JSON.parse(app.storage['starlight-rpg-v1']).adventurerState;
assert.equal(initial.tick, 0);
assert.equal(initial.explorationProgress, 0);
assert.equal(Object.keys(initial.locations).length, 100);

// Old v:2 saves gain only the deterministic NPC world state; player progress is retained.
const oldSave = JSON.parse(app.storage['starlight-rpg-v1']);
delete oldSave.adventurerState;
oldSave.gold = 987;
const migrated = boot(JSON.stringify(oldSave));
assert.equal(migrated.run('state.adventurerState.tick'), 0);
assert.equal(migrated.run('state.gold'), 987);

// A malformed NPC location resets the NPC simulation without resetting the RPG save.
const corruptSave = JSON.parse(app.storage['starlight-rpg-v1']);
corruptSave.gold = 1234;
corruptSave.adventurerState.locations.adventurer_001 = 'missing-node';
const recovered = boot(JSON.stringify(corruptSave));
assert.equal(recovered.run('state.gold'), 1234);
assert.equal(recovered.run("state.adventurerState.locations.adventurer_001"), 'home');

// Normal exploration ticks once every three successful starts, not on rejected attempts.
const exploration = boot();
exploration.run("state.node='meadow';state.village=false;action('explore')");
assert.equal(exploration.run('state.adventurerState.explorationProgress'), 1);
assert.equal(exploration.run('state.adventurerState.tick'), 0);
exploration.run("action('explore')");
assert.equal(exploration.run('state.adventurerState.explorationProgress'), 1, 'active battle does not count again');
exploration.run("state.enemy=null;action('explore')");
assert.equal(exploration.run('state.adventurerState.explorationProgress'), 2);
exploration.run("state.enemy=null;action('explore')");
assert.equal(exploration.run('state.adventurerState.explorationProgress'), 0);
assert.equal(exploration.run('state.adventurerState.tick'), 1);
const boss = boot();
boss.run("state.node='crossing';state.cleared[0]=false;state.kills[0]=4;action('boss')");
assert.equal(boss.run('state.adventurerState.explorationProgress'), 0, 'boss entry is not a normal exploration');

// Travel selection does not tick; each valid step does, including the arrival step.
const travel = boot();
assert.equal(travel.run("moveTo('home')"), true);
assert.equal(travel.run('state.adventurerState.tick'), 0);
assert.equal(travel.run('state.journey.step'), 0);
assert.equal(travel.run('advanceTravel()'), true);
assert.equal(travel.run('state.adventurerState.tick'), 1);
assert.equal(travel.run('state.journey.step'), 1);
const resumed = boot(travel.storage['starlight-rpg-v1']);
assert.equal(resumed.run('state.adventurerState.tick'), 1);
resumed.run('Math.random=()=>.99;advanceTravel()');
assert.equal(resumed.run('state.adventurerState.tick'), 2);
resumed.run('advanceTravel()');
assert.equal(resumed.run('state.adventurerState.tick'), 3);
assert.equal(resumed.run('state.node'), 'home');
resumed.run("moveTo('meadow');returnFromTravel()");
assert.equal(resumed.run('state.adventurerState.tick'), 3, 'route selection and return do not tick');
assert.equal(resumed.run('advanceTravel()'), false, 'an invalid step does not tick');
assert.equal(resumed.run('state.adventurerState.tick'), 3);

// A road encounter consumes one movement tick, while battle lock and arrival rendering do not add more.
const encounter = boot();
encounter.run("moveTo('home');Math.random=()=>0;advanceTravel()");
assert.equal(encounter.run('state.journey.step'), 1);
assert.equal(encounter.run('state.adventurerState.tick'), 1);
assert.equal(encounter.run('advanceTravel()'), false);
assert.equal(encounter.run('state.adventurerState.tick'), 1);
const lastStep = boot();
lastStep.run("moveTo('home');Math.random=()=>.99;advanceTravel();advanceTravel();advanceTravel()");
assert.equal(lastStep.run('state.node'), 'home');
assert.equal(lastStep.run('state.adventurerState.tick'), 3, 'arrival rendering does not duplicate the third step');

// Tavern details are scoped to the current town; quest controls remain available in their tab.
const tavern = boot();
tavern.run("state.node='home';state.zone=0;state.village=true;render();openTavern()");
assert.equal(tavern.nodes.tavernAdventurerCount.textContent, '34人');
assert.equal((tavern.nodes.tavernAdventurerList.innerHTML.match(/class="tavern-adventurer"/g) || []).length, 34);
tavern.run("action('adventurer-detail:adventurer_001')");
assert.equal(tavern.nodes.tavernAdventurerDetail.hidden, false);
assert.ok(tavern.nodes.tavernAdventurerDetailContent.innerHTML.includes('現在地：はじまりの村'));
assert.ok(tavern.nodes.tavernAdventurerDetailContent.innerHTML.includes('賢さ'));
tavern.run("action('adventurer-back');action('tavern-view:quests')");
assert.equal(tavern.nodes.tavernQuestView.hidden, false);
assert.equal((tavern.nodes.tavernQuests.innerHTML.match(/class="tavern-quest"/g) || []).length, 3);
tavern.run("action('tavern-view:adventurers')");
assert.equal(tavern.nodes.tavernAdventurerList.hidden, false);
console.log('PASS: exploration/travel tick integration, save migration, NPC-only recovery, town list/details and quest tab');
