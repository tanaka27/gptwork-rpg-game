const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = fs.readFileSync('dist/game.js', 'utf8');
function boot(saved = null) {
  const nodes = {}, storage = {};
  const node = () => ({innerHTML:'', textContent:'', disabled:false,
    classList:{add(){}, remove(){}, toggle(){}}, showModal(){}, close(){}, append(child){this.children??=[];this.children.push(child)}, scrollIntoView(){}});
  const context = {
    document:{getElementById:id=>nodes[id]??=node(), querySelectorAll:()=>[], addEventListener(){}, createElement:node},
    localStorage:{getItem:()=>saved, setItem:(key,value)=>storage[key]=value, removeItem:key=>delete storage[key]},
    console, setTimeout:fn=>{fn();return 1}, Math:Object.create(Math)
  };
  context.Math.random = () => .5;
  vm.createContext(context);
  vm.runInContext(source, context);
  return {run:code=>vm.runInContext(code,context), nodes, storage};
}
(async () => {
  const app = boot();
  assert.equal(app.run('mapNodes.length'),12);
  assert.equal(app.run('mapNodes.filter(n=>n.town).length'),3);
  assert.equal(app.run('new Set(bestiary.flat().map(e=>e.name)).size'),12);
  assert.equal(app.run('mapNodes.every(a=>a.links.every(id=>nodeById(id)?.links.includes(a.id)))'),true);
  assert.equal(app.run("moveTo('forge')"),false,'cannot teleport');
  assert.equal(app.run("moveTo('crossing')"),true);
  assert.equal(app.run("moveTo('luna')"),false,'progression gate');
  app.run('state.kills[0]=4;startBattle(true)');
  assert.equal(app.run("moveTo('meadow')"),false,'movement blocked in battle');
  await app.run("(async()=>{state.enemy.hp=1;await combat('attack')})()");
  assert.equal(app.run('state.cleared[0]'),true);
  assert.equal(app.run("moveTo('luna')"),true);
  assert.equal(app.run('state.village'),true);
  app.run("state.gold=500;action('buy:iron');action('equip:iron');state.hp=1;action('rest')");
  assert.equal(app.run('state.weapon'),'iron');
  assert.equal(app.run('state.hp===maxhp()'),true);
  app.run("moveTo('ruins');startBattle()");
  assert.equal(app.run('state.enemy.name'),'遺跡の歩哨');
  await app.run("(async()=>{state.hp=1;await combat('guard')})()");
  assert.equal(app.run('state.node'),'luna','rescue at most recently visited town');
  assert.equal(app.run('state.hp===maxhp()'),true);
  app.run("moveTo('ruins');state.kills[1]=4;startBattle(true);state.xp=100");
  assert.equal(app.run('state.enemy'),null);
  assert.equal(app.run('state.cleared[1]'),false,'boss cannot spawn away from boss node');
  app.run("moveTo('altar');startBattle(true);state.enemy.hp=1");
  await app.run("combat('attack')");
  assert.equal(app.run('state.cleared[1]'),true);
  assert.equal(app.run('state.lv>1'),true);
  assert.equal(app.run("moveTo('forge')"),true);
  app.run("moveTo('ash');moveTo('crater');moveTo('dragon');state.kills[2]=4;startBattle(true);state.enemy.hp=1");
  await app.run("combat('attack')");
  assert.equal(app.run('state.cleared.every(Boolean)'),true,'all areas reachable and completable');
  const loot = boot();
  for (const [roll, count] of [[0,4],[.0199,4],[.02,3],[.0799,3],[.08,2],[.2499,2],[.25,1],[.5499,1],[.55,0],[.99,0]]) {
    assert.equal(loot.run(`rollMaterials(bestiary[0][0],()=>${roll}).length`),count,'probability boundary '+roll);
  }
  assert.equal(loot.run("lootTable(bestiary[0][1])[0].id"),'fur');
  loot.run("state.zone=1");
  assert.equal(loot.run("lootTable(bestiary[1][0])[1].id"),'shard');
  loot.run("state.zone=0;moveTo('home');state.materials.starcore=2;state.gold=0;action('sell:starcore')");
  assert.equal(loot.run('state.materials.starcore'),1);
  assert.equal(loot.run('state.gold'),150);
  loot.run("moveTo('meadow');action('sell:starcore')");
  assert.equal(loot.run('state.materials.starcore'),1,'sell only in town');
  const migrated = boot(JSON.stringify({v:1,lv:5,xp:10,hp:70,mp:20,gold:250,weapon:'iron',armor:'cloth',owned:['twig','cloth','iron'],items:{herb:3,ether:1,potion:0},zone:1,kills:[5,2,0],cleared:[true,false,false],total:7,claimed:true,enemy:null,turn:1,log:[],village:true}));
  assert.equal(migrated.run('state.node'),'luna');
  assert.equal(migrated.run('state.lv'),5);
  assert.equal(migrated.run('state.gold'),250);
  assert.equal(migrated.run('state.weapon'),'iron');
  assert.equal(migrated.run('state.v'),2);
  const resumed = boot(loot.storage['starlight-rpg-v1']);
  assert.equal(resumed.run('state.materials.starcore'),1,'materials persist');
  assert.equal(resumed.run('state.node'),'meadow','position persists');
  const reset = boot(loot.storage['starlight-rpg-v1']);
  const beforeReset = reset.storage['starlight-rpg-v1'];
  reset.nodes.reset.onclick();
  assert.equal(reset.storage['starlight-rpg-v1'],beforeReset,'opening confirmation preserves save');
  assert.equal(reset.nodes.closeModal.textContent,'キャンセル');
  reset.nodes.closeModal.onclick();
  assert.equal(reset.storage['starlight-rpg-v1'],beforeReset,'cancel preserves save');
  reset.nodes.reset.onclick();
  const ok = reset.nodes.modalContent.children.at(-1);
  assert.equal(ok.textContent,'OK');
  ok.onclick();
  assert.equal(reset.storage['starlight-rpg-v1'],undefined,'OK deletes save without writing a replacement');
  assert.equal(reset.run('state.lv'),1);
  assert.equal(reset.run('Object.keys(state.materials).length'),0);
  assert.equal(reset.run('state.node'),'meadow');
  assert.equal(reset.run('state.gold'),30);
  reset.run("moveTo('home')");
  assert.ok(reset.storage['starlight-rpg-v1'],'next action resumes autosave');
  console.log('PASS: graph adjacency, battle movement lock, all progression gates and bosses, 3 towns, 12 monsters, shop, equipment, recovery, leveling, rarity probability boundaries, material sales, legacy save migration, persistence and confirmed save reset');
})().catch(error=>{console.error(error);process.exit(1)});
