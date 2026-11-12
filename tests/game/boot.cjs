// ゲーム本体（dist/game.js 等）をvm上で起動するテスト用ヘルパー。各 *.test.cjs から使う。
const fs = require('node:fs');
const vm = require('node:vm');
// party.jsの自動進行（scheduleRound）を止めて読み込む。整形の差に左右されないよう正規表現で置換し、見つからなければ失敗させる。
function withoutScheduledRound(source){const pattern=/function scheduleRound\(\)\s*\{\s*return partyRound\(\);?\s*\}/;if(!pattern.test(source))throw new Error('scheduleRound not found in dist/party.js');return source.replace(pattern,'function scheduleRound(){}');}
const source = fs.readFileSync('dist/game.js', 'utf8');
function boot(saved = null, party = false, manualMessages = false) {
  const nodes = {}, storage = {};
  const node = () => ({innerHTML:'', textContent:'', disabled:false,
    addEventListener(){}, focus(){}, classList:{add(){}, remove(){}, toggle(){}}, showModal(){}, close(){}, append(child){this.children??=[];this.children.push(child)}, scrollIntoView(){}});
  const context = {
    document:{getElementById:id=>nodes[id]??=node(), querySelectorAll:()=>[], addEventListener(){}, createElement:node},
    localStorage:{getItem:()=>saved, setItem:(key,value)=>storage[key]=value, removeItem:key=>delete storage[key]},
    console, setTimeout:fn=>{fn();return 1}, Math:Object.create(Math)
  };
  context.Math.random = () => .5;
  vm.createContext(context);
  context.GameData=JSON.parse(fs.readFileSync('content/game.json','utf8'));
  for(const file of ['shared/content.js','shared/rules.js','shared/quests.js','dist/storage.js'])vm.runInContext(fs.readFileSync(file,'utf8'),context);
  vm.runInContext(fs.readFileSync('dist/combat.js','utf8'),context);
  vm.runInContext(source, context);
  // Existing progression tests traverse real, uneventful three-step routes.
  vm.runInContext(`function walkTo(id){if(!moveTo(id))return false;const previous=Math.random;Math.random=()=>.99;try{for(let i=0;i<3;i++)advanceTravel();}finally{Math.random=previous;}return !state.journey;}`,context);
  if(party) {
    // Engine regressions supply a command at the hero's slot; controller timing is tested separately.
    vm.runInContext(withoutScheduledRound(fs.readFileSync('dist/party.js','utf8')),context);
    vm.runInContext(`commandResolve=()=>{};partyRound=function(kind,skillId,itemId,skillTargetIndex=selectedEnemy){if(busy||!state.enemy)return;return executePartyRound(i=>Promise.resolve(i===0?{kind,skillId,itemId,skillTargetIndex}:{kind:'attack'}));};submitCommand=(...args)=>partyRound(...args);`,context);
  }
  if(party&&!manualMessages)vm.runInContext('waitForBattleMessage=()=>Promise.resolve()',context);
  return {run:code=>vm.runInContext(code,context), nodes, storage};
}
// マイクロタスクを数回進め、Promiseで続く戦闘処理を反映させる。
const flush=async()=>{for(let i=0;i<5;i++)await Promise.resolve();};
module.exports={boot,flush};
