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
function setAllyHP(i,hp){
 if(i)state.companions[i-1].hp=hp;else state.hp=hp;
 if(hp<=0){const id=initialParty[i]?.id;for(const buff of state.buffs||[])if(buff.characterId===id)log(`${partyNames[i]}の${skillList.find(skill=>skill.id===buff.skillId)?.name||'バフ'}が解除された。`);state.buffs=(state.buffs||[]).filter(buff=>buff.characterId!==id);}
}
function allyAttack(i){return GameRules.allyAttack(state,GameData,i);}
function skillTargetsAlly(skill){return skill.effect==='heal'||skill.effect==='buff';}
function speedOf(i){return partySpeeds[i]+state.lv-1;}
function battleEnemies(){if(!state.enemy){state.enemies=[];return [];}if(!state.enemies?.some(e=>e.hp>0))state.enemies=[state.enemy];state.enemies.forEach((e,i)=>{e.speed??=8+state.zone*4+i*3;});state.enemy=state.enemies.find(e=>e.hp>0)||state.enemy;return state.enemies;}
function activeEnemies(){return battleEnemies().filter(e=>e.hp>0);}
function roundOrder(){return [...allies().map((a,i)=>({side:'ally',index:i,name:a.name,speed:speedOf(i),hp:allyHP(i)})),...battleEnemies().map((e,i)=>({side:'enemy',index:i,name:e.name,speed:e.speed,hp:e.hp}))].filter(a=>a.hp>0).sort((a,b)=>b.speed-a.speed||(a.side===b.side?a.index-b.index:a.side==='ally'?-1:1));}
const originalRender=render, originalStart=startBattle, originalWin=win;
let selectedEnemy=0;
let selectedCharacter=null;
let pendingItem=null;
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
 if(kind==='item'&&(!state.items[itemId]||!validItemTarget(itemId,skillTargetIndex)))return false;
 const resolve=commandResolve;commandResolve=null;busy=true;
 if(kind!=='item'){pendingItem=null;pendingSkill=null;skillMenuMode='commands';}$('subactions').innerHTML='';
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
$('screen-adventure').addEventListener('click',event=>{
 if(!battleMessageResolve)return;
 event.preventDefault();event.stopImmediatePropagation();advanceBattleMessage();
},true);
$('fieldMessage').onkeydown=event=>{
 if(battleMessageResolve&&(event.key==='Enter'||event.key===' ')){
  event.preventDefault();if(!event.repeat)advanceBattleMessage();
 }
};
function validSkillTarget(skill,index){
 if(!Number.isInteger(index)||index<0)return false;
 if(skill.effect==='buff')return !!state.enemy&&index<allies().length&&allyHP(index)>0;
 if(skill.effect==='heal')return index<allies().length&&allyHP(index)>0&&allyHP(index)<maxhp();
 return !!state.enemy&&index<battleEnemies().length&&battleEnemies()[index].hp>0;
}
function itemResource(id){return consumables[id]?.effects[0]?.type==='restoreMP'?'mp':'hp';}
function validItemTarget(id,index){
 if(!consumables[id]||!Number.isInteger(index)||index<0||index>=allies().length||allyHP(index)<=0)return false;
 const resource=itemResource(id),member=allies()[index];
 return member[resource]<(resource==='mp'?maxmp():maxhp());
}
function applyItem(id,index){
 if(!state.items[id]||!validItemTarget(id,index))return false;
 const resource=itemResource(id),member=allies()[index],limit=resource==='mp'?maxmp():maxhp();
 const amount=Math.min(limit-member[resource],GameRules.effectAmount(consumables[id].effects[0],{maxHP:maxhp(),maxMP:maxmp()},CombatRules));
 state.items[id]--;
 if(resource==='hp')setAllyHP(index,member.hp+amount);
 else if(index)state.companions[index-1].mp=member.mp+amount;else state.mp=member.mp+amount;
 log(`${consumables[id].name}で${partyNames[index]}の${resource.toUpperCase()}が${amount}回復。`);return true;
}
function enemyHPMeter(enemy){
 const percent=Math.max(0,Math.min(100,enemy.max>0?enemy.hp/enemy.max*100:0));
 return `<span class="enemy-hp bar" role="meter" aria-label="${enemy.name}のHP" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(percent)}"><i style="width:${percent}%"></i></span>`;
}
function renderAdventureLayout(){
 const screen=$('screen-adventure'),battle=!!state.enemy||roundActive;
 screen.classList.toggle('battle-active',battle);
 screen.classList.toggle('battle-menu',battle&&skillMenuMode!=='commands'&&!battleMessageResolve);
 screen.classList.toggle('choosing-enemy',battle&&!!pendingSkill&&skillMenuMode==='detail'&&skillList.find(s=>s.id===pendingSkill.id)?.effect==='damage');
 // Battle messages belong to the field, above the party, not below commands.
 const party=$('partyStatus');
 const arena=document.querySelector?.('.arena'),command=document.querySelector?.('.command'),message=$('fieldMessage');
 if(arena&&command){const parent=battle?arena:command;if(message.parentElement!==parent)parent.append(message);}
 if(!party.querySelectorAll)return;
 party.querySelectorAll('.party-member').forEach((member,i)=>{member.classList.toggle('acting',battle&&i===0&&!!commandResolve);member.querySelector('strong').dataset.level=state.lv;});
 if(arena)screen.style.setProperty('--party-height',party.getBoundingClientRect().height+'px');
}
globalThis.addEventListener?.('resize',renderAdventureLayout);
function renderSkillMenu(){
 const active=skillMenuMode!=='commands';
 $('actions').hidden=active;$('subactions').hidden=active;$('battleOrder').hidden=active||!$('battleOrder').textContent;$('skillMenu').hidden=!active;
 if(!active){$('skillMenu').innerHTML='';return;}
 if(skillMenuMode==='list'){
  const learned=skillList.filter(skill=>state.lv>=skill.lv);
  $('skillMenu').innerHTML='<div class="skill-list" aria-label="スキル一覧">'+(learned.map(skill=>`<button type="button" data-action="skill:${skill.id}" ${busy||state.hp<=0||state.mp<skill.cost||(skill.effect!=='heal'&&!state.enemy)?'disabled':''}><span>${skill.name}<small>${skillTypeLabel(skill)}</small></span><small>消費MP <b>${skill.cost}</b></small></button>`).join('')||'<p>Lv.2で最初のスキルを習得します。</p>')+'</div><div class="skill-footer">'+btn('戻る','skill-back')+'<span>どのスキルをつかいますか？</span></div>';
  return;
 }
 if(pendingItem){
  const item=consumables[pendingItem.id];
  $('skillMenu').innerHTML=`<article id="skillDetail"><h3>${item.name}<span>残り ${state.items[pendingItem.id]} 個</span></h3><p>${item.desc||''}</p><p class="skill-target-note">${state.items[pendingItem.id]>0?'回復する味方を選んでください。':'この道具はなくなりました。「戻る」で選び直してください。'}</p></article>`+btn('戻る','skill-back');return;
 }
 const skill=skillList.find(s=>s.id===pendingSkill?.id);
 if(!skill)return;
 const description=skill.effect==='heal'?`味方1人のHPを最大${GameRules.skillAmount(skill,{wisdom:wisdom(),attack:attack()},CombatRules)}回復します。`:skillDescription(skill);
 $('skillMenu').innerHTML=`<article id="skillDetail"><h3>${skill.name}<span>消費MP ${skill.cost}</span></h3><p>${skillTypeLabel(skill)} · ${description}</p><p class="skill-target-note">${skillTargetsAlly(skill)?(skill.effect==='buff'?'強化する味方を選んでください。':'回復する味方を選んでください。'):'だれにつかいますか？ フィールドの敵を選んでください。'}</p></article>`+btn('スキル一覧へ戻る','skill-list');
}
function chooseSkillTarget(skill){
 pendingSkill={id:skill.id,inBattle:!!state.enemy};skillMenuMode='detail';
 showScreen('adventure');render(false);
}
function castPendingSkill(index,side){
 const pending=pendingSkill,skill=skillList.find(s=>s.id===pending?.id);
 if(skillMenuMode!=='detail'||!pending||pending.inBattle!==!!state.enemy||busy||!skill||state.hp<=0||state.lv<skill.lv||state.mp<skill.cost||(skillTargetsAlly(skill)?'ally':'enemy')!==side||!validSkillTarget(skill,index))return false;
 pendingItem=null;pendingSkill=null;skillMenuMode='commands';$('subactions').innerHTML='';
 return useSkill(skill.id,index);
}

const characterPortraitFiles={astel:'astel',rina:'rina',gald:'gald',noel:'noel'};
function characterPortrait(characterId){
 const file=Object.hasOwn(characterPortraitFiles,characterId)?characterPortraitFiles[characterId]:null;
 return file?`<img class="character-portrait" src="assets/characters/${file}.png" alt="" width="512" height="512" decoding="async" draggable="false">`:'';
}
function buffIcons(index){
 return GameRules.activeBuffs(state,GameData,index).map(buff=>`<span class="buff-icon" role="img" aria-label="${buff.skill.name}：攻撃力${buff.effect.multiplier}倍、残り${buff.remainingTurns}ターン" title="${buff.skill.name}：攻撃力${buff.effect.multiplier}倍、残り${buff.remainingTurns}ターン"><span aria-hidden="true">⚔↑</span><b aria-hidden="true">${buff.remainingTurns}</b></span>`).join('');
}
function buffDetails(index){
 const buffs=GameRules.activeBuffs(state,GameData,index);
 return '<section class="buff-details" aria-label="バフの詳細"><h3>バフ</h3>'+ (buffs.length?buffs.map(buff=>`<p><strong>${buff.skill.name}</strong> · 攻撃力${buff.effect.multiplier}倍<br><span>残り${buff.remainingTurns}ターン</span>（付与したターンを除き、ターン終了時に減少）</p>`).join(''):'<p>有効なバフはありません。</p>')+'</section>';
}
function statusValueMarkup(label,value,base){
 const direction=Number.isFinite(value)&&Number.isFinite(base)?value>base?'up':value<base?'down':'':'';
 const description=direction?`${label} ${value}（基本値 ${base}より${direction==='up'?'上昇':'下降'}）`:'';
 return `<dd${direction?` class="stat-${direction}" title="${description}" aria-label="${description}"`:''}>${value}</dd>`;
}
function characterStatusCard(a,i,headingId='characterName'){
 return `<article class="character-card" aria-label="${a.name}のステータス"><div class="character-heading">${characterPortrait(a.characterId)}<h2 tabindex="-1" id="${headingId}">${a.name}</h2><span>Lv. ${state.lv} · ${allyHP(i)<=0?'戦闘不能':'行動可能'}</span></div><p>${i?'仲間 · 自動で通常攻撃':'主人公 · コマンド操作'}</p><dl>${[['HP',`${allyHP(i)} / ${maxhp()}`],['MP',`${a.mp} / ${maxmp()}`],['攻撃力',allyAttack(i),attack()],['守備力',defense()],['賢さ',wisdom()],['素早さ',speedOf(i)],['うんのよさ',luck()]].map(([label,value,base])=>`<div><dt>${label}</dt>${statusValueMarkup(label,value,base)}</div>`).join('')}</dl>${buffDetails(i)}</article>`;
}
function canInspectCharacter(){
 return !busy&&skillMenuMode==='commands'&&(state.enemy?!!commandResolve:!roundActive);
}
function openCharacterStatus(index){
 if(!canInspectCharacter()||!Number.isInteger(index))return;
 const member=allies()[index];if(!member)return;
 modal(member.name+'のステータス','');
 $('modal').setAttribute('aria-labelledby','battleCharacterName');
 $('modalContent').innerHTML=characterStatusCard(member,index,'battleCharacterName');
}
$('modal').addEventListener('close',()=>{$('modal').removeAttribute('aria-labelledby');});
document.addEventListener('click',event=>{
 const button=event.target.closest('[data-battle-character]');
 if(button&&!button.disabled)openCharacterStatus(Number(button.dataset.battleCharacter));
});
function renderCharacterScreen(){
 const members=allies();
 $('partyListView').hidden=selectedCharacter!==null;
 $('partyDetailView').hidden=selectedCharacter===null;
 $('characterList').innerHTML=members.map((a,i)=>`<button type="button" class="character-row" data-character="${i}" aria-label="${a.name}のステータスを見る">${characterPortrait(a.characterId)}<span><strong>${a.name}</strong><small>Lv. ${state.lv} · ${allyHP(i)<=0?'戦闘不能':i?'自動攻撃':'主人公'}</small></span><span class="character-row-hp">HP ${allyHP(i)} / ${maxhp()}<br>MP ${a.mp} / ${maxmp()}</span><span aria-hidden="true">›</span></button>`).join('');
 const selected=members.map((a,i)=>({a,i})).filter(({i})=>i===selectedCharacter);

 $('partyDetails').innerHTML=selected.map(({a,i})=>characterStatusCard(a,i)).join('');
}
const previousShowScreen=showScreen;
showScreen=function(name){if(name!=='adventure'&&skillMenuMode!=='commands'){pendingItem=null;pendingSkill=null;skillMenuMode='commands';render(false);}if(name==='party'){selectedCharacter=null;renderCharacterScreen();}previousShowScreen(name);};
startBattle=function(boss=false,travelEncounter=false){if(state.enemy||state.village||busy||(state.journey&&(!travelEncounter||boss)))return;originalStart(boss,travelEncounter);if(!state.enemy)return;state.buffs=[];const first=state.enemy;state.enemies=[first,...Array.from({length:3},(_,i)=>{const e=bestiary[state.zone][i%bestiary[state.zone].length];return {...e,hp:e.hp,max:e.hp,boss:false};})];state.enemies.forEach((e,i)=>e.speed=(e.speed??((GameData.rules.battle.baseEnemySpeed??8)+state.zone*(GameData.rules.battle.enemySpeedPerZone??4)))+i*(GameData.rules.battle.slotSpeedStep??3));selectedEnemy=0;render();scheduleRound();};
render=function(persist=true){GameRules.normalizeBuffs(state,GameData);if(pendingItem&&(pendingItem.inBattle!==!!state.enemy||state.hp<=0)){pendingItem=null;skillMenuMode='commands';}allies();const enemies=battleEnemies();originalRender(false);
 if(pendingSkill){const skill=skillList.find(s=>s.id===pendingSkill.id);if(pendingSkill.inBattle!==!!state.enemy||!skill||state.lv<skill.lv||state.hp<=0){pendingItem=null;pendingSkill=null;skillMenuMode='commands';}}
 renderCharacterScreen();
 const healingSkill=busy?null:pendingItem?consumables[pendingItem.id]:skillMenuMode==='detail'?skillList.find(s=>s.id===pendingSkill?.id&&skillTargetsAlly(s)):null;
 if(state.enemy&&!(enemies[selectedEnemy]?.hp>0))selectedEnemy=enemies.findIndex(e=>e.hp>0);
 $('attributes').innerHTML+=`<div>素早さ<b>${speedOf(0)}</b></div>`;
 const inspectCharacter=canInspectCharacter();
 $('partyStatus').innerHTML=allies().map((a,i)=>`<${healingSkill||inspectCharacter?'button':'div'} ${healingSkill?`type="button" data-ally-target="${i}" aria-label="${a.name}に${healingSkill.name}を使う" ${busy||!(pendingItem?(state.items[pendingItem.id]>0&&validItemTarget(pendingItem.id,i)):validSkillTarget(healingSkill,i))?'disabled':''}`:inspectCharacter?`type="button" data-battle-character="${i}" aria-haspopup="dialog" aria-label="${a.name}のステータスを見る"`:''} class="party-member ${allyHP(i)<=0?'fallen':''}">${characterPortrait(a.characterId)}${buffIcons(i)}<strong>${healingSkill?'<span class="ally-target-marker" aria-hidden="true">▼</span>':''}${a.name}${allyHP(i)<=0?' · 戦闘不能':''}</strong>${meter('HP',allyHP(i),maxhp())}${meter('MP',a.mp,maxmp(),'mp')}</${healingSkill||inspectCharacter?'button':'div'}>`).join('');
 if(state.enemy){$('enemy').innerHTML=enemies.map((e,i)=>`<button class="enemy-unit ${e.hp<=0?'fallen':''}" data-target="${i}" aria-pressed="${!healingSkill&&i===selectedEnemy}" aria-label="${e.name}を攻撃対象に選択" ${e.hp<=0||busy||healingSkill?'disabled':''}><span class="enemy-target-marker" aria-hidden="true">▼</span>${monster(e)}<strong>${e.name}</strong>${enemyHPMeter(e)}</button>`).join('');$('battleOrder').textContent='行動順：'+roundOrder().map(a=>a.name).join(' → ');$('commandTitle').textContent=partyNames[0]+'の行動を選択（仲間は自動攻撃）';}else $('battleOrder').textContent=state.journey?'道中では戦闘・何もなし・素材入手が起こります。':'';
 renderSkillMenu();renderAdventureLayout();
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
     if(Math.random()<GameData.rules.battle.escapeRate){state.buffs=[];state.enemy=null;state.enemies=[];log('旅団は逃げきった。');await showBattleMessages();busy=false;finishTravel();save();render(false);return;}
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
   else if(i===0&&kind==='item'){if(!applyItem(itemId,skillTargetIndex??0))log('道具の対象を回復できないため、消費せず見送った。');}
   else if(i===0&&kind==='skill'){
    if(skill.effect==='buff'){
     if(state.mp>=skill.cost&&validSkillTarget(skill,skillTargetIndex)&&GameRules.applyAttackBuff(state,GameData,skillTargetIndex,skill)){
      state.mp-=skill.cost;const effect=skill.effects[0];log(`${partyNames[skillTargetIndex]}に${skill.name}！ 攻撃力${effect.multiplier}倍・${effect.turns}ターン。`);
     }else log(`${skill.name}を使えないため、MPを消費せず見送った。`);
    }else if(skill.effect==='heal'){
     if(validSkillTarget(skill,skillTargetIndex)){
      const healed=Math.min(maxhp()-allyHP(skillTargetIndex),GameRules.skillAmount(skill,{wisdom:wisdom(),attack:attack()},CombatRules));
      state.mp-=skill.cost;setAllyHP(skillTargetIndex,allyHP(skillTargetIndex)+healed);
      log(`${actor.name}の${skill.name}！ ${partyNames[skillTargetIndex]}のHPが${healed}回復。`);
     }else log(`${skill.name}の対象を回復できないため、MPを消費せず見送った。`);
    }else{
     state.mp-=skill.cost;const result=GameRules.skillResult(skill,{wisdom:wisdom(),attack:allyAttack(i),defense:target.def,luck:luck()},CombatRules),damage=result.amount;
     target.hp=Math.max(0,target.hp-damage);log(`${actor.name}の${skill.name}！ ${result.critical?'会心の一撃！ ' : ''}${target.name}に${damage}。`);
    }
   }
   else{const damage=CombatRules.physicalDamage({attack:allyAttack(i),defense:target.def,power:normalAttack.power});target.hp=Math.max(0,target.hp-damage);log(`${actor.name}の攻撃！ ${target.name}に${damage}。`);}
  }else{
   const enemy=enemies[actor.index];if(enemy.hp<=0)continue;
   state.lastRoundOrder.push(actor.name);
   log(`${enemy.name}の攻撃！`);
   await showBattleMessages();
   const targets=allies().map((a,i)=>i).filter(i=>allyHP(i)>0);const target=targets[Math.floor(Math.random()*targets.length)];const damage=CombatRules.physicalDamage({attack:enemy.atk,defense:defense(),strong:state.turn%GameData.rules.battle.strongEvery===0,guard:target===0&&guarding});setAllyHP(target,Math.max(0,allyHP(target)-damage));log(`${enemy.name}の攻撃！ ${partyNames[target]}に${damage}。`);}
  state.enemy=enemies.find(e=>e.hp>0)||enemies[0];render(false);
  await showBattleMessages();
 }
 if(enemies.some(e=>e.hp>0)&&allies().some((a,i)=>allyHP(i)>0)){
  for(const buff of GameRules.tickBuffs(state,GameData))log(`${partyNames[initialParty.findIndex(a=>a.id===buff.characterId)]}の${buff.skill.name}の効果が切れた。`);
  await showBattleMessages();
 }
 state.turn++;
 if(!allies().some((a,i)=>allyHP(i)>0)){const lost=Math.floor(state.gold*GameData.rules.battle.rescueRate);state.gold-=lost;state.buffs=[];state.enemy=null;state.enemies=[];state.journey=null;state.node=state.lastTown;state.zone=currentNode().zone;state.village=true;state.hp=maxhp();state.mp=maxmp();state.companions.forEach(a=>{a.hp=maxhp();a.mp=maxmp();});log(`旅団は全滅。救助費${lost} Gで街へ戻った。`);}
 else if(enemies.every(e=>e.hp<=0)){state.buffs=[];for(const e of [...enemies].sort((a,b)=>Number(a.boss)-Number(b.boss))){state.enemy=e;originalWin();await showBattleMessages();}state.enemies=[];state.companions.forEach(a=>{a.hp=Math.max(1,Math.min(a.hp,maxhp()));});}
 else state.enemy=enemies.find(e=>e.hp>0);
 await showBattleMessages();
 busy=false;$('subactions').innerHTML='';finishTravel();save();render(false);
}
combat=kind=>submitCommand(kind);
useSkill=function(id,targetIndex=null){
 const skill=skillList.find(s=>s.id===id);
 if(!skill||busy||(state.enemy&&!commandResolve)||state.hp<=0||state.lv<skill.lv||state.mp<skill.cost||(skill.effect!=='heal'&&!state.enemy))return false;
 if(targetIndex===null){chooseSkillTarget(skill);return true;}
 if(!validSkillTarget(skill,targetIndex))return false;
 if(state.enemy){if(skill.effect==='damage')selectedEnemy=targetIndex;return submitCommand('skill',id,null,targetIndex);}
 const healed=Math.min(maxhp()-allyHP(targetIndex),GameRules.skillAmount(skill,{wisdom:wisdom(),attack:attack()},CombatRules));
 state.mp-=skill.cost;setAllyHP(targetIndex,allyHP(targetIndex)+healed);
 log(`${skill.name}！ ${partyNames[targetIndex]}のHPが${healed}回復。`);render();return true;
};
useItem=function(id,targetIndex=null){
 if(busy||state.hp<=0||(state.enemy&&!commandResolve)||!consumables[id]||!state.items[id])return false;
 if(targetIndex===null){pendingSkill=null;pendingItem={id,inBattle:!!state.enemy};skillMenuMode='detail';showScreen('adventure');render(false);return true;}
 if(!validItemTarget(id,targetIndex))return false;
 pendingSkill=null;pendingItem={id,inBattle:!!state.enemy};skillMenuMode='detail';
 if(state.enemy)return submitCommand('item',null,id,targetIndex);
 const used=applyItem(id,targetIndex);render();return used;
};
const originalAction=action;
action=function(a){
 const [key,id,target]=a.split(':');
 if(key==='cast'){if(pendingSkill?.id!==id)return false;return castPendingSkill(Number(target),skillTargetsAlly(skillList.find(s=>s.id===id)||{})?'ally':'enemy');}
 if(busy)return;
 if(key==='skills'||key==='skill-list'){pendingItem=null;pendingSkill=null;skillMenuMode='list';$('subactions').innerHTML='';render(false);return;}
 if(key==='cancel-skill'||key==='skill-back'){pendingItem=null;pendingSkill=null;skillMenuMode='commands';render(false);return;}
 if(key!=='skill'){pendingItem=null;pendingSkill=null;skillMenuMode='commands';}
 const resting=a==='rest'&&state.village&&!state.journey&&!state.enemy&&!busy;originalAction(a);if(resting){state.companions.forEach(c=>{c.hp=state.hp;c.mp=state.mp;});render();}};
document.addEventListener('click',event=>{const button=event.target.closest('[data-target]');if(button&&!button.disabled&&!busy){const index=Number(button.dataset.target);if(pendingSkill){castPendingSkill(index,'enemy');return;}selectedEnemy=index;render();}});
document.addEventListener('click',event=>{const button=event.target.closest('[data-ally-target]');if(button&&!button.disabled&&!busy){if(pendingItem){if(pendingItem.inBattle===!!state.enemy)useItem(pendingItem.id,Number(button.dataset.allyTarget));}else castPendingSkill(Number(button.dataset.allyTarget),'ally');}});
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!busy&&skillMenuMode!=='commands'){pendingItem=null;pendingSkill=null;skillMenuMode='commands';render(false);}});
document.addEventListener('click',event=>{const button=event.target.closest('[data-character]');if(button){const index=Number(button.dataset.character);if(Number.isInteger(index)&&index>=0&&index<allies().length){selectedCharacter=index;renderCharacterScreen();$('characterName').focus();}}});
$('backToParty').onclick=()=>{const index=selectedCharacter;selectedCharacter=null;renderCharacterScreen();document.querySelector(`[data-character="${index}"]`)?.focus();};
const originalResetAdventure=resetAdventure;
resetAdventure=function(){if(busy||roundActive)return;pendingItem=null;pendingSkill=null;skillMenuMode='commands';originalResetAdventure();};
$('help').addEventListener('click',()=>{$('modalContent').innerHTML+='<p>旅団は最大4人、敵は最大4体。仲間3人は自動攻撃。戦闘開始後は素早さ順に進み、アステルの番でコマンドを選択します。防御は選択後からラウンド終了まで有効です。素早さが高い順に行動し、戦闘不能者は行動しません。戦闘メッセージ待ちでは、背景・暗いコマンド部分・メッセージ窓をクリック（タップ）して先へ進めます。行動の開始メッセージを送ると、その行動のダメージ・回復を反映します。結果のメッセージを送るまで次の行動には進みません。報酬もクリックして確認します。フォーカスしてEnter・スペースでも操作できます。非戦闘時の通常操作中と、戦闘中の主人公のコマンド入力待ちでは、味方の状態欄をクリックするとステータスを確認できます。閉じる・Escで戻ります。敵や仲間の自動行動中は味方欄のクリックでも戦闘メッセージが進みます。スキル・道具の選択中には開きません。道具を選んだら味方の状態欄をクリックして使います。使用後も対象選択にとどまり、同じ道具を続けて使えます。戦闘中は次のアステルの番まで再使用できません。満タン・戦闘不能の味方は対象外です。戻る・Escでは道具もターンも消費しません。「スキル」でコマンドを一覧へ切り替え、スキルの詳細を確認したらフィールドの敵または上部の味方をクリックして発動します。「戻る」でコマンドへ戻れます。選択のキャンセルではMP・ターンを消費しません。Lv.2で習得する特技「鼓舞」は戦闘中に味方1人の攻撃力を1.5倍にし、3ターン継続します。同じ効果は重ならず再使用で残数を更新。付与したターンは減らず、次のターン終了から減少します。画像上の剣↑と残数が目印で、ステータス詳細から効果を確認できます。攻撃力は補正後の値を表示し、上昇中は青、下降中は赤になります。戦闘終了・戦闘不能で解除されます。宿屋で全員回復します。</p>';});
allies();render();if(state.enemy)scheduleRound();
