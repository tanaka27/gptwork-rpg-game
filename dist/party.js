'use strict';
// 主人公の既存フィールドは保持し、仲間と敵隊列を追加する。
const partyNames=['アステル','リナ','ガルド','ノエル'];
const partySpeeds=[12,18,7,14];
function allies(){
  state.companions??=partyNames.slice(1).map((name,i)=>({name,hp:maxhp(),mp:maxmp(),speed:partySpeeds[i+1]}));
  state.companions=state.companions.slice(0,3);
  return [{name:'アステル',hp:state.hp,mp:state.mp,speed:partySpeeds[0]},...state.companions];
}
function allyHP(i){return i?state.companions[i-1].hp:state.hp;}
function setAllyHP(i,hp){if(i)state.companions[i-1].hp=hp;else state.hp=hp;}
function speedOf(i){return partySpeeds[i]+state.lv-1;}
function battleEnemies(){if(!state.enemy){state.enemies=[];return [];}if(!state.enemies?.some(e=>e.hp>0))state.enemies=[state.enemy];state.enemies.forEach((e,i)=>{e.speed??=8+state.zone*4+i*3;});state.enemy=state.enemies.find(e=>e.hp>0)||state.enemy;return state.enemies;}
function activeEnemies(){return battleEnemies().filter(e=>e.hp>0);}
function roundOrder(){return [...allies().map((a,i)=>({side:'ally',index:i,name:a.name,speed:speedOf(i),hp:allyHP(i)})),...battleEnemies().map((e,i)=>({side:'enemy',index:i,name:e.name,speed:e.speed,hp:e.hp}))].filter(a=>a.hp>0).sort((a,b)=>b.speed-a.speed||(a.side===b.side?a.index-b.index:a.side==='ally'?-1:1));}
const originalRender=render, originalStart=startBattle, originalWin=win, originalUseItem=useItem, originalUseSkill=useSkill;
let selectedEnemy=0;
let selectedCharacter=null;
function renderCharacterScreen(){
 const members=allies();
 $('partyListView').hidden=selectedCharacter!==null;
 $('partyDetailView').hidden=selectedCharacter===null;
 $('characterList').innerHTML=members.map((a,i)=>`<button type="button" class="character-row" data-character="${i}" aria-label="${a.name}のステータスを見る"><span class="character-emblem" aria-hidden="true">${['⚔','✧','♜','♧'][i]}</span><span><strong>${a.name}</strong><small>Lv. ${state.lv} · ${allyHP(i)<=0?'戦闘不能':i?'自動攻撃':'主人公'}</small></span><span class="character-row-hp">HP ${allyHP(i)} / ${maxhp()}<br>MP ${a.mp} / ${maxmp()}</span><span aria-hidden="true">›</span></button>`).join('');
 const selected=members.map((a,i)=>({a,i})).filter(({i})=>i===selectedCharacter);

 $('partyDetails').innerHTML=selected.map(({a,i})=>`<article class="character-card" aria-label="${a.name}のステータス"><div class="character-heading"><h2 tabindex="-1" id="characterName">${a.name}</h2><span>Lv. ${state.lv} · ${allyHP(i)<=0?'戦闘不能':'行動可能'}</span></div><p>${i?'仲間 · 自動で通常攻撃':'主人公 · コマンド操作'}</p><dl>${[['HP',`${allyHP(i)} / ${maxhp()}`],['MP',`${a.mp} / ${maxmp()}`],['攻撃力',attack()],['守備力',defense()],['賢さ',wisdom()],['素早さ',speedOf(i)]].map(([label,value])=>`<div><dt>${label}</dt><dd>${value}</dd></div>`).join('')}</dl></article>`).join('');
}
const previousShowScreen=showScreen;
showScreen=function(name){if(name==='party'){selectedCharacter=null;renderCharacterScreen();}previousShowScreen(name);};
startBattle=function(boss=false,travelEncounter=false){if(state.enemy||state.village||busy||(state.journey&&(!travelEncounter||boss)))return;originalStart(boss,travelEncounter);if(!state.enemy)return;const first=state.enemy;state.enemies=[first,...Array.from({length:3},(_,i)=>{const e=bestiary[state.zone][i];return {...e,hp:e.hp,max:e.hp,boss:false};})];state.enemies.forEach((e,i)=>e.speed=8+state.zone*4+i*3);selectedEnemy=0;render();};
render=function(persist=true){allies();const enemies=battleEnemies();originalRender(false);
 renderCharacterScreen();
 $('attributes').innerHTML+=`<div>素早さ<b>${speedOf(0)}</b></div>`;
 $('partyStatus').innerHTML=allies().map((a,i)=>`<div class="party-member ${allyHP(i)<=0?'fallen':''}"><strong>${a.name}${allyHP(i)<=0?' · 戦闘不能':''}</strong>${meter('HP',allyHP(i),maxhp())}${meter('MP',a.mp,maxmp(),'mp')}</div>`).join('');
 if(state.enemy){$('enemy').innerHTML=enemies.map((e,i)=>`<button class="enemy-unit ${e.hp<=0?'fallen':''}" data-target="${i}" aria-pressed="${i===selectedEnemy}" ${e.hp<=0?'disabled':''}>${monster(e)}<strong>${e.name}</strong><span>HP ${e.hp}/${e.max} · 速 ${e.speed}</span></button>`).join('');$('battleOrder').textContent='行動順：'+roundOrder().map(a=>a.name).join(' → ');$('commandTitle').textContent='アステルの行動を選択（仲間は自動攻撃）';}else $('battleOrder').textContent=state.journey?'道中では戦闘・何もなし・素材入手が起こります。':'仲間は自動攻撃。対象を選んで、素早さ順に1ラウンド行動。';
 if(persist)save();
};
async function partyRound(kind,skillId,itemId){
 if(!state.enemy||busy)return;
 const enemies=battleEnemies();
 if(kind==='run'){if(enemies.some(e=>e.boss&&e.hp>0)){log('ボスからは逃げられない！');render();return;}if(Math.random()<.7){state.enemy=null;state.enemies=[];$('subactions').innerHTML='';log('旅団は逃げきった。');finishTravel();render();return;}}
 const skill=skillList.find(s=>s.id===skillId);
 if(kind==='skill'&&(!skill||state.lv<skill.lv||state.mp<skill.cost||state.hp<=0))return;
 if(kind==='item'&&(!consumables[itemId]||state.items[itemId]<=0||state.hp<=0))return;
 busy=true;const order=roundOrder();state.lastRoundOrder=[];
 for(const actor of order){
  if(!enemies.some(e=>e.hp>0)||!allies().some((a,i)=>allyHP(i)>0))break;
  if(actor.side==='ally'){
   const i=actor.index;if(allyHP(i)<=0)continue;
   state.lastRoundOrder.push(actor.name);
   let target=enemies[selectedEnemy]?.hp>0?enemies[selectedEnemy]:enemies.find(e=>e.hp>0);
   if(i===0&&kind==='guard'){state.mp=Math.min(maxmp(),state.mp+3);log('アステルは身を守った。');}
   else if(i===0&&kind==='item'){state.items[itemId]--;if(itemId==='ether')state.mp=Math.min(maxmp(),state.mp+18);else state.hp=Math.min(maxhp(),state.hp+(itemId==='herb'?45:maxhp()));log(`${consumables[itemId].name}でアステルを回復。`);}
   else if(i===0&&kind==='skill'){state.mp-=skill.cost;if(skill.effect==='heal'){state.hp=Math.min(maxhp(),state.hp+CombatRules.magicAmount(wisdom(),skill));log('星のいやしで回復。');}else{const damage=skill.type==='magic'?CombatRules.magicAmount(wisdom(),skill):CombatRules.physicalDamage({attack:attack(),defense:target.def,power:skill.power});target.hp=Math.max(0,target.hp-damage);log(`${actor.name}の${skill.name}！ ${target.name}に${damage}。`);}}
   else{const damage=CombatRules.physicalDamage({attack:attack(),defense:target.def});target.hp=Math.max(0,target.hp-damage);log(`${actor.name}の攻撃！ ${target.name}に${damage}。`);}
  }else{const enemy=enemies[actor.index];if(enemy.hp<=0)continue;state.lastRoundOrder.push(actor.name);const targets=allies().map((a,i)=>i).filter(i=>allyHP(i)>0);const target=targets[Math.floor(Math.random()*targets.length)];const damage=CombatRules.physicalDamage({attack:enemy.atk,defense:defense(),strong:state.turn%3===0,guard:target===0&&kind==='guard'});setAllyHP(target,Math.max(0,allyHP(target)-damage));log(`${enemy.name}の攻撃！ ${partyNames[target]}に${damage}。`);}
  state.enemy=enemies.find(e=>e.hp>0)||enemies[0];render(false);
  await new Promise(resolve=>setTimeout(resolve,120));
 }
 state.turn++;
 if(!allies().some((a,i)=>allyHP(i)>0)){const lost=Math.floor(state.gold*.15);state.gold-=lost;state.enemy=null;state.enemies=[];state.journey=null;state.node=state.lastTown;state.zone=currentNode().zone;state.village=true;state.hp=maxhp();state.mp=maxmp();state.companions.forEach(a=>{a.hp=maxhp();a.mp=maxmp();});log(`旅団は全滅。救助費${lost} Gで街へ戻った。`);}
 else if(enemies.every(e=>e.hp<=0)){for(const e of [...enemies].sort((a,b)=>Number(a.boss)-Number(b.boss))){state.enemy=e;originalWin();}state.enemies=[];state.companions.forEach(a=>{a.hp=Math.max(1,Math.min(a.hp,maxhp()));});}
 else state.enemy=enemies.find(e=>e.hp>0);
 busy=false;$('subactions').innerHTML='';finishTravel();render();
}
combat=kind=>partyRound(kind);
useSkill=id=>state.enemy?partyRound('skill',id):originalUseSkill(id);
useItem=id=>state.enemy?partyRound('item',null,id):originalUseItem(id);
const originalAction=action;
action=function(a){const resting=a==='rest'&&state.village&&!state.journey&&!state.enemy&&!busy;originalAction(a);if(resting){state.companions.forEach(c=>{c.hp=state.hp;c.mp=state.mp;});render();}};
document.addEventListener('click',event=>{const button=event.target.closest('[data-target]');if(button&&!busy){selectedEnemy=Number(button.dataset.target);render();}});
document.addEventListener('click',event=>{const button=event.target.closest('[data-character]');if(button){const index=Number(button.dataset.character);if(Number.isInteger(index)&&index>=0&&index<allies().length){selectedCharacter=index;renderCharacterScreen();$('characterName').focus();}}});
$('backToParty').onclick=()=>{const index=selectedCharacter;selectedCharacter=null;renderCharacterScreen();document.querySelector(`[data-character="${index}"]`)?.focus();};
$('help').addEventListener('click',()=>{$('modalContent').innerHTML+='<p>旅団は最大4人、敵は最大4体。仲間3人は自動攻撃。敵を選択し、アステルのコマンドで1ラウンド開始します。素早さが高い順に行動し、戦闘不能者は行動しません。道具・回復魔法はアステルが対象。宿屋で全員回復します。</p>';});
allies();render();
