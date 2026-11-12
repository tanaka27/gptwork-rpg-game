const assert = require('node:assert/strict');
const { boot } = require('./boot.cjs');

const oldSave = ({ total, claimed, gold = 30 }) =>
  JSON.stringify({
    v: 2,
    node: 'home',
    lastTown: 'home',
    zone: 0,
    lv: 1,
    xp: 0,
    hp: 80,
    mp: 20,
    gold,
    weapon: 'twig',
    armor: 'cloth',
    owned: ['twig', 'cloth'],
    items: { herb: 3, ether: 1, potion: 0 },
    materials: {},
    kills: [0, 0, 0],
    cleared: [false, false, false],
    total,
    claimed,
    enemy: null,
    journey: null,
    turn: 1,
    log: [],
    village: true,
  });

const app = boot();
app.run("state.node='home';state.zone=0;state.village=true;state.total=4;state.gold=30;render()");
app.run("action('claim');action('quest-report')");
assert.equal(app.run('state.gold'), 30, 'the legacy direct claim action cannot grant the reward');
assert.equal(app.run('state.questState.active'), null, 'an unaccepted request cannot be reported');
assert.equal(app.run('openTavern()'), true);
assert.equal(app.nodes.tavernMenu.hidden, false);
assert.equal((app.nodes.tavernQuests.innerHTML.match(/<article class="tavern-quest"/g) || []).length, 3);
assert.ok(app.nodes.tavernQuests.innerHTML.includes('魔物を累計5体倒す'));
assert.ok(app.nodes.tavernQuests.innerHTML.includes('100 G'));
app.run("action('quest-accept:village_bounty')");
assert.equal(app.run('state.questState.active.id'), 'village_bounty');
assert.equal(app.run('QuestRules.canReport(state.questState,state.total,state.claimed)'), false);
app.run('state.total=5;render()');
app.run("action('quest-report')");
assert.equal(app.run('state.gold'), 130);
assert.equal(app.run('state.items.potion'), 2);
assert.equal(app.run('state.claimed'), true);
assert.equal(app.run("state.questState.completedIds.includes('village_bounty')"), true);
app.run("action('claim');action('quest-report');action('quest-accept:village_bounty')");
assert.equal(app.run('state.gold'), 130, 'the legacy reward can only be reported once');
assert.equal(app.run('state.items.potion'), 2);
assert.equal(app.run('state.questState.active'), null);

app.run("openTavern();action('quest-accept:apprentice_hunt')");
assert.equal(app.run('state.questState.active.acceptedAtTotal'), 5);
assert.equal(app.run('QuestRules.progress("apprentice_hunt",state.total,state.questState.active)'), 0);
assert.equal(app.run("action('quest-accept:veteran_hunt');state.questState.active.id"), 'apprentice_hunt', 'one active request blocks another');
app.run('state.total=7;render()');
assert.equal(app.run('QuestRules.canReport(state.questState,state.total,state.claimed)'), false, 'not enough new defeats');
assert.equal(app.run('reportQuest()'), false, 'report processing checks the condition again');
assert.equal(app.run('state.gold'), 130);
const resumedApprentice = boot(app.storage['starlight-rpg-v1']);
assert.equal(resumedApprentice.run('state.questState.active.id'), 'apprentice_hunt', 'accepted progress survives reload');
assert.equal(resumedApprentice.run('state.questState.active.acceptedAtTotal'), 5);
resumedApprentice.run('state.total=8;openTavern();action("quest-report")');
assert.equal(resumedApprentice.run('state.gold'), 165);
assert.equal(resumedApprentice.run("state.questState.completedIds.includes('apprentice_hunt')"), true);
resumedApprentice.run("action('quest-report')");
assert.equal(resumedApprentice.run('state.gold'), 165, 'a repeated report does not grant gold again');

resumedApprentice.run("action('quest-accept:veteran_hunt')");
assert.equal(resumedApprentice.run('state.questState.active.acceptedAtTotal'), 8);
assert.equal(resumedApprentice.run('reportQuest()'), false, 'a new request does not count earlier defeats');
resumedApprentice.run('state.total=16;render();action("quest-report")');
assert.equal(resumedApprentice.run('state.gold'), 255);
assert.equal(resumedApprentice.run('state.items.potion'), 3);
assert.equal(resumedApprentice.run('state.questState.active'), null);

const oldUnclaimed = boot(oldSave({ total: 5, claimed: false, gold: 12 }));
assert.deepEqual(
  JSON.parse(oldUnclaimed.run('JSON.stringify(state.questState)')),
  { active: null, completedIds: [] },
  'a legacy unclaimed reward remains available'
);
oldUnclaimed.run("action('quest-report');openTavern()");
oldUnclaimed.run("action('quest-accept:village_bounty');action('quest-report')");
assert.equal(oldUnclaimed.run('state.gold'), 112, 'old lifetime defeats count toward the existing reward');
assert.equal(oldUnclaimed.run('state.items.potion'), 2);
assert.equal(oldUnclaimed.run('state.claimed'), true);

const oldClaimed = boot(oldSave({ total: 8, claimed: true, gold: 37 }));
assert.equal(oldClaimed.run("state.questState.completedIds.includes('village_bounty')"), true);
oldClaimed.run("openTavern();action('quest-report');action('claim')");
assert.equal(oldClaimed.run('state.gold'), 37, 'legacy claimed saves never receive a second payout');
assert.equal(oldClaimed.run('state.items.potion'), 0);

const invalidSave = JSON.parse(app.storage['starlight-rpg-v1']);
invalidSave.claimed = true;
invalidSave.questState = { active: null, completedIds: ['apprentice_hunt', 'apprentice_hunt'] };
const recovered = boot(JSON.stringify(invalidSave));
assert.equal(recovered.run("state.questState.completedIds.includes('apprentice_hunt')"), true, 'valid completed jobs survive malformed-state recovery');
assert.equal(recovered.run('state.questState.completedIds.length'), 2, 'recovery deduplicates jobs and retains the claimed legacy bounty');
const futureSave = JSON.parse(app.storage['starlight-rpg-v1']);
futureSave.questState = {
  active: { id: 'veteran_hunt', acceptedAtTotal: futureSave.total + 1 },
  completedIds: ['village_bounty', 'apprentice_hunt'],
};
const recoveredFuture = boot(JSON.stringify(futureSave));
assert.equal(recoveredFuture.run('state.questState.active'), null, 'an invalid future baseline drops only the active request');
assert.equal(recoveredFuture.run('state.questState.completedIds.length'), 2, 'other completed requests survive active-state recovery');

const outsideTown = boot();
outsideTown.run('state.total=100;state.node="meadow";state.village=false;render()');
assert.equal(outsideTown.run('openTavern()'), false, 'the tavern is only available in town');
outsideTown.run("action('quest-accept:apprentice_hunt');action('quest-report')");
assert.equal(outsideTown.run('state.gold'), 30, 'town checks also guard direct actions');

const missingBeforeAccept = boot();
missingBeforeAccept.run('state.node="home";state.village=true;state.total=5;delete consumables.potion;render();openTavern()');
assert.ok(missingBeforeAccept.nodes.tavernQuests.innerHTML.includes('現在、この依頼の報酬を用意できません'));
assert.ok(missingBeforeAccept.nodes.tavernQuests.innerHTML.includes('data-action="quest-accept:village_bounty" disabled'));
const missingRewardBefore = missingBeforeAccept.run('JSON.stringify({gold:state.gold,items:state.items,questState:state.questState})');
missingBeforeAccept.run("action('quest-accept:village_bounty')");
assert.equal(missingBeforeAccept.run('state.questState.active'), null, 'missing reward definitions block acceptance in the action handler');
assert.equal(missingBeforeAccept.run('JSON.stringify({gold:state.gold,items:state.items,questState:state.questState})'), missingRewardBefore);
missingBeforeAccept.run("action('quest-accept:apprentice_hunt')");
assert.equal(missingBeforeAccept.run('state.questState.active.id'), 'apprentice_hunt', 'quests without item rewards remain available');

const missingAfterAccept = boot();
missingAfterAccept.run('state.node="home";state.village=true;state.total=5;openTavern();action("quest-accept:village_bounty");delete consumables.potion;render()');
assert.ok(missingAfterAccept.nodes.tavernQuests.innerHTML.includes('現在、この依頼の報酬を用意できません'));
assert.ok(missingAfterAccept.nodes.tavernQuests.innerHTML.includes('data-action="quest-report" disabled'));
const unavailableReportBefore = missingAfterAccept.run('JSON.stringify({gold:state.gold,items:state.items,questState:state.questState,claimed:state.claimed})');
missingAfterAccept.run("action('quest-report')");
assert.equal(missingAfterAccept.run('state.questState.active.id'), 'village_bounty', 'an unavailable report keeps the accepted request intact');
assert.equal(
  missingAfterAccept.run('JSON.stringify({gold:state.gold,items:state.items,questState:state.questState,claimed:state.claimed})'),
  unavailableReportBefore,
  'missing reward definitions do not change progress, reward, or legacy claim state'
);

console.log('PASS: tavern quest selection, acceptance, progress, reports, legacy reward migration and persistence');
