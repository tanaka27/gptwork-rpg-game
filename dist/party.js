'use strict';
// 主人公の既存フィールドは保持し、仲間と敵隊列を追加する。
const initialParty=GameData.rules.party.map(id=>GameData.characters.find(c=>c.id===id));
const partyNames=initialParty.map(c=>c.name),partySpeeds=initialParty.map(c=>c.speed);
function allies(){
 const previous=state.companions||[],hasIds=previous.some(c=>c.characterId);
 state.companions=initialParty.slice(1).map((character,i)=>{
  const saved=previous.find(c=>c.characterId===character.id)||(!hasIds?previous[i]:null);
  return {...saved,characterId:character.id,name:character.name,hp:saved?.hp??maxhp(),mp:saved?.mp??maxmp(),speed:character.speed};
 });
 return [{characterId:initialParty[0].id,name:partyNames[0],hp:state.hp,mp:state.mp,speed:partySpeeds[0]},...state.companions];
}
function allyHP(i){return i?state.companions[i-1].hp:state.hp;}
function setAllyHP(i,hp){if(i)state.companions[i-1].hp=hp;else state.hp=hp;}
function speedOf(i){return partySpeeds[i]+state.lv-1;}
function battleEnemies(){if(!state.enemy){state.enemies=[];return [];}if(!state.enemies?.some(e=>e.hp>0))state.enemies=[state.enemy];state.enemies.forEach((e,i)=>{e.speed??=8+state.zone*4+i*3;});state.enemy=state.enemies.find(e=>e.hp>0)||state.enemy;return state.enemies;}
function activeEnemies(){return battleEnemies().filter(e=>e.hp>0);}
function roundOrder(){return [...allies().map((a,i)=>({side:'ally',index:i,name:a.name,speed:speedOf(i),hp:allyHP(i)})),...battleEnemies().map((e,i)=>({side:'enemy',index:i,name:e.name,speed:e.speed,hp:e.hp}))].filter(a=>a.hp>0).sort((a,b)=>b.speed-a.speed||(a.side===b.side?a.index-b.index:a.side==='ally'?-1:1));}
const originalRender=render, originalStart=startBattle, originalWin=win, originalUseItem=useItem;
let selectedEnemy=0;
let selectedCharacter=null;
let pendingSkill=null;
let skillMenuMode='commands';
let roundActive=false, commandResolve=null;
function scheduleRound(){return partyRound();}
function waitForCommand(){
 busy=false;log(`${partyNames[0]}の番です。行動を選んでください。`);
 return new Promise(resolve=>{commandResolve=resolve;render(false);});
}
function submitCommand(kind,skillId,itemId,skillTargetIndex=selectedEnemy){
 if(!commandResolve||busy||state.hp<=0)return false;
 const skill=skillList.find(s=>s.id===skillId);
 if(!['attack','guard','run','skill','item'].includes(kind))return false;
 if(kind==='run'&&activeEnemies().some(e=>e.boss)){log('ボスからは逃げられない！');render(false);return false;}
 if(kind==='skill'&&(!skill||state.lv<skill.lv||state.mp<skill.cost||!validSkillTarget(skill,skillTargetIndex)))return false;
 if(kind==='item'&&(!consumables[itemId]||!state.items[itemId]))return false;
 const resolve=commandResolve;commandResolve=null;busy=true;
 pendingSkill=null;skillMenuMode='commands';$('subactions').innerHTML='';
 resolve({kind,skillId,itemId,skillTargetIndex});render(false);return true;
}
// ラウンド中のログを、時間ではなくメッセージ窓の操作で1件ずつ送る。
let battleMessageResolve=null, battleMessageText=null;
const battleMessages=[];
const originalLog=log;
log=function(message){originalLog(message);if(busy)battleMessages.push(message);};
function advanceBattleMessage(){
 if(!battleMessageResolve)return;
 const resolve=battleMessageResolve;
 battleMessageResolve=null;battleMessageText=null;
 resolve();
}
function waitForBattleMessage(message){
 battleMessageText=message;
 return new Promise(resolve=>{battleMessageResolve=resolve;render(false);});
}
async function showBattleMessages(){
 while(battleMessages.length)await waitForBattleMessage(battleMessages.shift());
}
$('fieldMessage').onclick=advanceBattleMessage;
$('fieldMessage').onkeydown=event=>{
 if(battleMessageResolve&&(event.key==='Enter'||event.key===' ')){
  event.preventDefault();if(!event.repeat)advanceBattleMessage();
 }
};
function validSkillTarget(skill,index){
 if(!Number.isInteger(index)||index<0)return false;
 if(skill.effect==='heal')return index<allies().length&&allyHP(index)>0&&allyHP(index)<maxhp();
 return !!state.enemy&&index<battleEnemies().length&&battleEnemies()[index].hp>0;
}
function enemyHPMeter(enemy){
 const percent=Math.max(0,Math.min(100,enemy.max>0?enemy.hp/enemy.max*100:0));
 return `<span class="enemy-hp bar" role="meter" aria-label="${enemy.name}のHP" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(percent)}"><i style="width:${percent}%"></i></span>`;
}
function renderSkillMenu(){
 const active=skillMenuMode!=='commands';
 $('actions').hidden=active;$('subactions').hidden=active;$('battleOrder').hidden=active||!$('battleOrder').textContent;$('skillMenu').hidden=!active;
 if(!active){$('skillMenu').innerHTML='';return;}
 if(skillMenuMode==='list'){
  const learned=skillList.filter(skill=>state.lv>=skill.lv);
  $('skillMenu').innerHTML='<div class="skill-list" aria-label="スキル一覧">'+(learned.map(skill=>`<button type="button" data-action="skill:${skill.id}" ${busy||state.hp<=0||state.mp<skill.cost||(skill.effect==='damage'&&!state.enemy)?'disabled':''}><span>${skill.name}</span><small>MP ${skill.cost}</small></button>`).join('')||'<p>Lv.2で最初のスキルを習得します。</p>')+'</div>'+btn('戻る','skill-back');
  return;
 }
 const skill=skillList.find(s=>s.id===pendingSkill?.id);
 if(!skill)return;
 const description=skill.effect==='heal'?`味方1人のHPを最大${GameRules.skillAmount(skill,{wisdom:wisdom(),attack:attack()},CombatRules)}回復します。`:skill.desc;
 $('skillMenu').innerHTML=`<article id="skillDetail"><h3>${skill.name}<span>消費MP ${skill.cost}</span></h3><p>${skillTypeLabel(skill)} · ${description}</p><p class="skill-target-note">${skill.effect==='heal'?'上部の回復する味方をクリックしてください。':'フィールドの敵をクリックすると発動します。'}</p></article>`+btn('スキル一覧へ戻る','skill-list');
}
function chooseSkillTarget(skill){
 pendingSkill={id:skill.id,inBattle:!!state.enemy};skillMenuMode='detail';
 showScreen('adventure');render(false);
}
function castPendingSkill(index,side){
 const pending=pendingSkill,skill=skillList.find(s=>s.id===pending?.id);
 if(skillMenuMode!=='detail'||!pending||pending.inBattle!==!!state.enemy||busy||!skill||state.hp<=0||state.lv<skill.lv||state.mp<skill.cost||(skill.effect==='heal'?'ally':'enemy')!==side||!validSkillTarget(skill,index))return false;
 pendingSkill=null;skillMenuMode='commands';$('subactions').innerHTML='';
 return useSkill(skill.id,index);
}

function renderCharacterScreen(){
 const members=allies();
 $('partyListView').hidden=selectedCharacter!==null;
 $('partyDetailView').hidden=selectedCharacter===null;
 $('characterList').innerHTML=members.map((a,i)=>`<button type="button" class="character-row" data-character="${i}" aria-label="${a.name}のステータスを見る"><span class="character-emblem" aria-hidden="true">${['⚔','✧','♜','♧'][i]}</span><span><strong>${a.name}</strong><small>Lv. ${state.lv} · ${allyHP(i)<=0?'戦闘不能':i?'自動攻撃':'主人公'}</small></span><span class="character-row-hp">HP ${allyHP(i)} / ${maxhp()}<br>MP ${a.mp} / ${maxmp()}</span><span aria-hidden="true">›</span></button>`).join('');
 const selected=members.map((a,i)=>({a,i})).filter(({i})=>i===selectedCharacter);

 $('partyDetails').innerHTML=selected.map(({a,i})=>`<article class="character-card" aria-label="${a.name}のステータス"><div class="character-heading"><h2 tabindex="-1" id="characterName">${a.name}</h2><span>Lv. ${state.lv} · ${allyHP(i)<=0?'戦闘不能':'行動可能'}</span></div><p>${i?'仲間 · 自動で通常攻撃':'主人公 · コマンド操作'}</p><dl>${[['HP',`${allyHP(i)} / ${maxhp()}`],['MP',`${a.mp} / ${maxmp()}`],['攻撃力',attack()],['守備力',defense()],['賢さ',wisdom()],['素早さ',speedOf(i)]].map(([label,value])=>`<div><dt>${label}</dt><dd>${value}</dd></div>`).join('')}</dl></article>`).join('');
}
const previousShowScreen=showScreen;
showScreen=function(name){if(name!=='adventure'&&skillMenuMode!=='commands'){pendingSkill=null;skillMenuMode='commands';render(false);}if(name==='party'){selectedCharacter=null;renderCharacterScreen();}previousShowScreen(name);};
startBattle=function(boss=false,travelEncounter=false){if(state.enemy||state.village||busy||(state.journey&&(!travelEncounter||boss)))return;originalStart(boss,travelEncounter);if(!state.enemy)return;const first=state.enemy;state.enemies=[first,...Array.from({length:3},(_,i)=>{const e=bestiary[state.zone][i%bestiary[state.zone].length];return {...e,hp:e.hp,max:e.hp,boss:false};})];state.enemies.forEach((e,i)=>e.speed=(e.speed??((GameData.rules.battle.baseEnemySpeed??8)+state.zone*(GameData.rules.battle.enemySpeedPerZone??4)))+i*(GameData.rules.battle.slotSpeedStep??3));selectedEnemy=0;render();scheduleRound();};
render=function(persist=true){allies();const enemies=battleEnemies();originalRender(false);
 if(pendingSkill){const skill=skillList.find(s=>s.id===pendingSkill.id);if(pendingSkill.inBattle!==!!state.enemy||!skill||state.lv<skill.lv||state.hp<=0){pendingSkill=null;skillMenuMode='commands';}}
 renderCharacterScreen();
 const healingSkill=skillMenuMode==='detail'?skillList.find(s=>s.id===pendingSkill?.id&&s.effect==='heal'):null;
 if(state.enemy&&!(enemies[selectedEnemy]?.hp>0))selectedEnemy=enemies.findIndex(e=>e.hp>0);
 $('attributes').innerHTML+=`<div>素早さ<b>${speedOf(0)}</b></div>`;
 $('partyStatus').innerHTML=allies().map((a,i)=>`<${healingSkill?'button':'div'} ${healingSkill?`type="button" data-ally-target="${i}" aria-label="${a.name}に${healingSkill.name}を使う" ${busy||!validSkillTarget(healingSkill,i)?'disabled':''}`:''} class="party-member ${allyHP(i)<=0?'fallen':''}"><strong>${healingSkill?'<span class="ally-target-marker" aria-hidden="true">▼</span>':''}${a.name}${allyHP(i)<=0?' · 戦闘不能':''}</strong>${meter('HP',allyHP(i),maxhp())}${meter('MP',a.mp,maxmp(),'mp')}</${healingSkill?'button':'div'}>`).join('');
 if(state.enemy){$('enemy').innerHTML=enemies.map((e,i)=>`<button class="enemy-unit ${e.hp<=0?'fallen':''}" data-target="${i}" aria-pressed="${!healingSkill&&i===selectedEnemy}" aria-label="${e.name}を攻撃対象に選択" ${e.hp<=0||busy||healingSkill?'disabled':''}><span class="enemy-target-marker" aria-hidden="true">▼</span>${monster(e)}<strong>${e.name}</strong>${enemyHPMeter(e)}</button>`).join('');$('battleOrder').textContent='行動順：'+roundOrder().map(a=>a.name).join(' → ');$('commandTitle').textContent=partyNames[0]+'の行動を選択（仲間は自動攻撃）';}else $('battleOrder').textContent=state.journey?'道中では戦闘・何もなし・素材入手が起こります。':'';
 renderSkillMenu();
 const waiting=!!battleMessageResolve;
 $('fieldMessage').classList.toggle('awaiting-click',waiting);
 $('fieldMessage').role=waiting?'button':'group';
 $('fieldMessage').tabIndex=waiting?0:-1;
 $('messageNext').hidden=!waiting;
 if(battleMessageText!==null)$('latestLog').textContent=battleMessageText;
 $('reset').disabled=busy||roundActive;
 if(state.enemy)$('commandTitle').textContent=commandResolve?partyNames[0]+'の番：行動を選択':'素早さ順に行動中（メッセージを送って進行）';
 if(persist&&!busy&&!roundActive)save();
};
async function partyRound(){
 if(!state.enemy||busy||roundActive)return;
 roundActive=true;
 while(state.enemy)await executePartyRound(waitForCommand);
 roundActive=false;render(false);
}
async function executePartyRound(getCommand){
 let kind=null,skillId,itemId,skillTargetIndex=selectedEnemy,skill,guarding=false;
 if(!state.enemy)return;
 const enemies=battleEnemies();
 busy=true;const order=roundOrder();state.lastRoundOrder=[];
 for(const actor of order){
  if(!enemies.some(e=>e.hp>0)||!allies().some((a,i)=>allyHP(i)>0))break;
  if(actor.side==='ally'){
   const i=actor.index;if(allyHP(i)<=0)continue;
   if(i===0){
    ({kind,skillId,itemId,skillTargetIndex}=await getCommand());
    busy=true;skill=skillList.find(s=>s.id===skillId);
    if(kind==='run'){
     log('旅団は逃走を試みた！');await showBattleMessages();
     if(Math.random()<GameData.rules.battle.escapeRate){state.enemy=null;state.enemies=[];log('旅団は逃げきった。');await showBattleMessages();busy=false;finishTravel();save();render(false);return;}
     log('逃げられなかった！');await showBattleMessages();continue;
    }
   }
   state.lastRoundOrder.push(actor.name);
   const announcement=i===0&&kind==='guard'?`${actor.name}は身を守る！`:i===0&&kind==='item'?`${actor.name}は${consumables[itemId].name}を使う！`:i===0&&kind==='skill'?`${actor.name}の${skill.name}！`:`${actor.name}の攻撃！`;
   log(announcement);
   await showBattleMessages();
   const targetIndex=i===0&&kind==='skill'&&skill.effect==='damage'?skillTargetIndex:selectedEnemy;
   let target=enemies[targetIndex]?.hp>0?enemies[targetIndex]:enemies.find(e=>e.hp>0);
   if(i===0&&kind==='guard'){guarding=true;state.mp=Math.min(maxmp(),state.mp+GameData.rules.battle.guardMPRestore);log(`${partyNames[0]}は身を守った。`);}
   else if(i===0&&kind==='item'){state.items[itemId]--;if(itemId==='ether')state.mp=Math.min(maxmp(),state.mp+GameRules.effectAmount(consumables[itemId].effects[0],{maxHP:maxhp(),maxMP:maxmp()},CombatRules));else state.hp=Math.min(maxhp(),state.hp+GameRules.effectAmount(consumables[itemId].effects[0],{maxHP:maxhp(),maxMP:maxmp()},CombatRules));log(`${consumables[itemId].name}で${partyNames[0]}を回復。`);}
   else if(i===0&&kind==='skill'){
    if(skill.effect==='heal'){
     if(validSkillTarget(skill,skillTargetIndex)){
      const healed=Math.min(maxhp()-allyHP(skillTargetIndex),GameRules.skillAmount(skill,{wisdom:wisdom(),attack:attack()},CombatRules));
      state.mp-=skill.cost;setAllyHP(skillTargetIndex,allyHP(skillTargetIndex)+healed);
      log(`${actor.name}の${skill.name}！ ${partyNames[skillTargetIndex]}のHPが${healed}回復。`);
     }else log(`${skill.name}の対象を回復できないため、MPを消費せず見送った。`);
    }else{
     state.mp-=skill.cost;const damage=GameRules.skillAmount(skill,{wisdom:wisdom(),attack:attack(),defense:target.def},CombatRules);
     target.hp=Math.max(0,target.hp-damage);log(`${actor.name}の${skill.name}！ ${target.name}に${damage}。`);
    }
   }
   else{const damage=CombatRules.physicalDamage({attack:attack(),defense:target.def,power:normalAttack.power});target.hp=Math.max(0,target.hp-damage);log(`${actor.name}の攻撃！ ${target.name}に${damage}。`);}
  }else{
   const enemy=enemies[actor.index];if(enemy.hp<=0)continue;
   state.lastRoundOrder.push(actor.name);
   log(`${enemy.name}の攻撃！`);
   await showBattleMessages();
   const targets=allies().map((a,i)=>i).filter(i=>allyHP(i)>0);const target=targets[Math.floor(Math.random()*targets.length)];const damage=CombatRules.physicalDamage({attack:enemy.atk,defense:defense(),strong:state.turn%GameData.rules.battle.strongEvery===0,guard:target===0&&guarding});setAllyHP(target,Math.max(0,allyHP(target)-damage));log(`${enemy.name}の攻撃！ ${partyNames[target]}に${damage}。`);}
  state.enemy=enemies.find(e=>e.hp>0)||enemies[0];render(false);
  await showBattleMessages();
 }
 state.turn++;
 if(!allies().some((a,i)=>allyHP(i)>0)){const lost=Math.floor(state.gold*GameData.rules.battle.rescueRate);state.gold-=lost;state.enemy=null;state.enemies=[];state.journey=null;state.node=state.lastTown;state.zone=currentNode().zone;state.village=true;state.hp=maxhp();state.mp=maxmp();state.companions.forEach(a=>{a.hp=maxhp();a.mp=maxmp();});log(`旅団は全滅。救助費${lost} Gで街へ戻った。`);}
 else if(enemies.every(e=>e.hp<=0)){for(const e of [...enemies].sort((a,b)=>Number(a.boss)-Number(b.boss))){state.enemy=e;originalWin();await showBattleMessages();}state.enemies=[];state.companions.forEach(a=>{a.hp=Math.max(1,Math.min(a.hp,maxhp()));});}
 else state.enemy=enemies.find(e=>e.hp>0);
 await showBattleMessages();
 busy=false;$('subactions').innerHTML='';finishTravel();save();render(false);
}
combat=kind=>submitCommand(kind);
useSkill=function(id,targetIndex=null){
 const skill=skillList.find(s=>s.id===id);
 if(!skill||busy||(state.enemy&&!commandResolve)||state.hp<=0||state.lv<skill.lv||state.mp<skill.cost||(skill.effect==='damage'&&!state.enemy))return false;
 if(targetIndex===null){chooseSkillTarget(skill);return true;}
 if(!validSkillTarget(skill,targetIndex))return false;
 if(state.enemy){if(skill.effect==='damage')selectedEnemy=targetIndex;return submitCommand('skill',id,null,targetIndex);}
 const healed=Math.min(maxhp()-allyHP(targetIndex),GameRules.skillAmount(skill,{wisdom:wisdom(),attack:attack()},CombatRules));
 state.mp-=skill.cost;setAllyHP(targetIndex,allyHP(targetIndex)+healed);
 log(`${skill.name}！ ${partyNames[targetIndex]}のHPが${healed}回復。`);render();return true;
};
useItem=id=>state.enemy?submitCommand('item',null,id):originalUseItem(id);
const originalAction=action;
action=function(a){
 const [key,id,target]=a.split(':');
 if(key==='cast'){if(pendingSkill?.id!==id)return false;return castPendingSkill(Number(target),skillList.find(s=>s.id===id)?.effect==='heal'?'ally':'enemy');}
 if(busy)return;
 if(key==='skills'||key==='skill-list'){pendingSkill=null;skillMenuMode='list';$('subactions').innerHTML='';render(false);return;}
 if(key==='cancel-skill'||key==='skill-back'){pendingSkill=null;skillMenuMode='commands';render(false);return;}
 if(key!=='skill'){pendingSkill=null;skillMenuMode='commands';}
 const resting=a==='rest'&&state.village&&!state.journey&&!state.enemy&&!busy;originalAction(a);if(resting){state.companions.forEach(c=>{c.hp=state.hp;c.mp=state.mp;});render();}};
document.addEventListener('click',event=>{const button=event.target.closest('[data-target]');if(button&&!button.disabled&&!busy){const index=Number(button.dataset.target);if(pendingSkill){castPendingSkill(index,'enemy');return;}selectedEnemy=index;render();}});
document.addEventListener('click',event=>{const button=event.target.closest('[data-ally-target]');if(button&&!button.disabled&&!busy)castPendingSkill(Number(button.dataset.allyTarget),'ally');});
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!busy&&skillMenuMode!=='commands'){pendingSkill=null;skillMenuMode='commands';render(false);}});
document.addEventListener('click',event=>{const button=event.target.closest('[data-character]');if(button){const index=Number(button.dataset.character);if(Number.isInteger(index)&&index>=0&&index<allies().length){selectedCharacter=index;renderCharacterScreen();$('characterName').focus();}}});
$('backToParty').onclick=()=>{const index=selectedCharacter;selectedCharacter=null;renderCharacterScreen();document.querySelector(`[data-character="${index}"]`)?.focus();};
const originalResetAdventure=resetAdventure;
resetAdventure=function(){if(busy||roundActive)return;pendingSkill=null;skillMenuMode='commands';originalResetAdventure();};
$('help').addEventListener('click',()=>{$('modalContent').innerHTML+='<p>旅団は最大4人、敵は最大4体。仲間3人は自動攻撃。戦闘開始後は素早さ順に進み、アステルの番でコマンドを選択します。防御は選択後からラウンド終了まで有効です。素早さが高い順に行動し、戦闘不能者は行動しません。行動の開始メッセージをクリック（タップ）すると、その行動のダメージ・回復を反映します。結果のメッセージを送るまで次の行動には進みません。報酬もクリックして確認します。フォーカスしてEnter・スペースでも操作できます。道具はアステルが対象。「スキル」でコマンドを一覧へ切り替え、スキルの詳細を確認したらフィールドの敵または上部の味方をクリックして発動します。「戻る」でコマンドへ戻れます。選択のキャンセルではMP・ターンを消費しません。宿屋で全員回復します。</p>';});
allies();render();if(state.enemy)scheduleRound();
