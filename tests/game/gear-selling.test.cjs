// 装備の売却額・売却・並べ替えと絞り込み・装着中との比較。
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {boot} = require('./boot.cjs');
const rules = require('../../shared/rules.js');
const saves = require('../../shared/save.js');
const content = require('../../shared/content.js');
const data = content.withJobs(JSON.parse(fs.readFileSync('content/game.json', 'utf8')));
const item = (id, rarity = null) => { const base = data.items.find(e => e.id === id); return {...base, rarity: rarity || base.rarity}; };

// 売却額：ショップ価格の半分（非売品は装備Lv×10）×レアリティ倍率（1 / 1.5 / 2.5 / 5）。
assert.equal(rules.gearSellPrice(item('iron')), 35);
assert.equal(rules.gearSellPrice(item('iron', 'uncommon')), 52);
assert.equal(rules.gearSellPrice(item('iron', 'rare')), 87);
assert.equal(rules.gearSellPrice(item('iron', 'legendary')), 175);
assert.equal(rules.gearSellPrice(item('iron', 'epic')), 122, 'epic multiplier 3.5 rounds down');
assert.equal(rules.gearSellPrice(item('moonsteel_blade')), 315);
assert.equal(rules.gearSellPrice(item('twig')), 10);
assert.equal(rules.gearSellPrice(item('eclipse_robe')), 300);
assert.equal(rules.gearSellPrice(item('starlight_blade')), 800);

const app = boot(null, true);
app.run("allies();state.node='home';state.village=true;state.journey=null;state.gold=0");
const ironUid = app.run("GameRules.addGear(state,GameData,'iron',(()=>{const r=[.995,.5,.5,.5,.5,.5,.5,.5,.5];return()=>r.shift();})()).uid");
// 2段階：売却ボタンで確認を出し、確定で売る。やめると何も変わらない。
app.run(`selectedGearId='${ironUid}';gearDetailOrigin='bag';tab='bag';action('sell-gear:${ironUid}')`);
assert.equal(app.run('pendingSellUid'), ironUid);
app.run("action('sell-gear-cancel')");
assert.equal(app.run('pendingSellUid'), null);
assert.equal(app.run(`state.gear.some(e=>e.uid===${ironUid})`), true);
// 確認なしの確定は無視する。
app.run(`action('sell-gear-confirm:${ironUid}')`);
assert.equal(app.run(`state.gear.some(e=>e.uid===${ironUid})`), true);
app.run(`action('sell-gear:${ironUid}');action('sell-gear-confirm:${ironUid}')`);
assert.equal(app.run(`state.gear.some(e=>e.uid===${ironUid})`), false);
assert.equal(app.run('state.gold'), 175);
assert.equal(app.run('state.log[0]'), '鉄のつるぎ［レジェンダリー］を175 Gで売却した。');
assert.equal(app.run("state.owned.includes('iron')"), false, 'mirrors drop sold gear');
assert.equal(app.run('selectedGearId'), null);
assert.deepEqual(saves.validate(JSON.parse(app.run('JSON.stringify(state)')), data), []);
// 装着中の個体と、街の外での売却は拒否する。
const worn = app.run('state.weaponUid');
app.run(`action('sell-gear:${worn}');action('sell-gear-confirm:${worn}')`);
assert.equal(app.run(`state.gear.some(e=>e.uid===${worn})`), true);
assert.equal(JSON.parse(app.run(`JSON.stringify(GameRules.sellGear(state,GameData,${worn}))`)).reason, 'equipped');
const leatherUid = app.run("GameRules.addGear(state,GameData,'leather').uid");
app.run(`state.village=false;action('sell-gear:${leatherUid}');action('sell-gear-confirm:${leatherUid}')`);
assert.equal(app.run(`state.gear.some(e=>e.uid===${leatherUid})`), true, 'cannot sell outside town');

// 並べ替えと絞り込み。
app.run("state.village=true;GameRules.addGear(state,GameData,'starlight_blade');GameRules.addGear(state,GameData,'moonsteel_blade')");
const order = () => [...app.run("gearInventoryRows(0)").matchAll(/data-gear-id="([a-z_]+)"/g)].map(m => m[1]);
assert.deepEqual(order().slice(-3), ['leather', 'starlight_blade', 'moonsteel_blade'], 'acquired order by default');
app.run("gearView={sort:'newest',filter:'all'}");assert.deepEqual(order().slice(0, 2), ['moonsteel_blade', 'starlight_blade']);
app.run("gearView={sort:'rarity',filter:'all'}");assert.deepEqual(order().slice(0, 2), ['starlight_blade', 'moonsteel_blade']);
app.run("gearView={sort:'level',filter:'all'}");assert.deepEqual(order().slice(0, 2), ['starlight_blade', 'moonsteel_blade']);
app.run("gearView={sort:'acquired',filter:'armor'}");assert.ok(order().every(id => ['cloth', 'leather'].includes(id)));
app.run("gearView={sort:'acquired',filter:'stored'}");assert.deepEqual(order(), ['leather', 'starlight_blade', 'moonsteel_blade']);
app.run("gearView={sort:'acquired',filter:'weapon'};state.gear=state.gear.filter(e=>[state.armorUid,...state.companions.map(c=>c.armorUid)].includes(e.uid)||[state.weaponUid,...state.companions.map(c=>c.weaponUid)].includes(e.uid))");
assert.equal(app.run("gearView={sort:'acquired',filter:'stored'};gearInventoryRows(0)").includes('該当する装備はありません'), true);

// 比較：操作する人物の同じ部位の装備との差を出す（攻撃は基礎補正込み）。
app.run("state.lv=16;const b=GameRules.addGear(state,GameData,'starlight_blade');actingAlly=1");
const compare = app.run("gearComparisonMarkup(GameRules.gearItem(GameData,state.gear[state.gear.length-1]),1)");
assert.match(compare, /リナの装着中（旅人の剣）と比べて/);
assert.match(compare, /攻撃力 \+25/);
assert.match(compare, /素早さ \+4/);
assert.match(compare, /うんのよさ \+6/);
assert.equal(app.run("gearComparisonMarkup(GameRules.memberGear(state,GameData,1,'weapon'),1)"), '', 'no comparison for the worn item');
console.log('PASS: gear sell prices, two-step selling in town, sorting and filtering, and comparison with worn gear');
