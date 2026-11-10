(function(root,factory){const api=factory();if(typeof module==='object')module.exports=api;else root.GameRules=api;})(typeof globalThis!=='undefined'?globalThis:this,()=>{
'use strict';
const characterDefaults={"rina": {"baseHP": 64, "hpPerLevel": 14, "baseMP": 24, "mpPerLevel": 5, "baseAttack": 12, "attackPerLevel": 3, "baseDefense": 6, "defensePerLevel": 2, "baseWisdom": 14, "wisdomPerLevel": 5, "baseLuck": 14, "luckPerLevel": 3}, "gald": {"baseHP": 100, "hpPerLevel": 20, "baseMP": 12, "mpPerLevel": 2, "baseAttack": 18, "attackPerLevel": 5, "baseDefense": 12, "defensePerLevel": 3, "baseWisdom": 6, "wisdomPerLevel": 2, "baseLuck": 8, "luckPerLevel": 1}, "noel": {"baseHP": 68, "hpPerLevel": 14, "baseMP": 32, "mpPerLevel": 6, "baseAttack": 10, "attackPerLevel": 3, "baseDefense": 7, "defensePerLevel": 2, "baseWisdom": 18, "wisdomPerLevel": 6, "baseLuck": 12, "luckPerLevel": 2}};
function memberState(state,data,index=0){
 if(index===0)return state;
 const members=state.companions||[],identified=members.some(a=>a?.characterId);
 return members.find(a=>a?.characterId===data.rules.party[index])||(!identified?members[index-1]:null)||{};
}
function stats(state,data,index=0){
 const character=data.characters.find(c=>c.id===data.rules.party[index]);
 const g={...data.rules.growth,...characterDefaults[character?.id],...character?.stats},level=state.lv-1,member=memberState(state,data,index);
 const weapon=data.items.find(e=>e.id===(member.weapon??state.weapon)),armor=data.items.find(e=>e.id===(member.armor??state.armor));
 const result={maxHP:g.baseHP+level*g.hpPerLevel,maxMP:g.baseMP+level*g.mpPerLevel,attack:g.baseAttack+level*g.attackPerLevel+(weapon?.value||0),defense:g.baseDefense+level*g.defensePerLevel+(armor?.value||0),wisdom:g.baseWisdom+level*g.wisdomPerLevel,luck:(g.baseLuck??10)+level*(g.luckPerLevel??2),speed:(character?.speed??0)+level,threshold:data.rules.growth.baseExperience+state.lv*data.rules.growth.experiencePerLevel};
 for(const item of [weapon,armor])for(const effect of item?.bonusEffects||[])if(Object.hasOwn(result,effect.stat))result[effect.stat]+=effect.amount;
 return result;
}
function skillOwnerId(skill,data){return skill?.characterId??data?.rules?.party?.[0]??null;}
function skillOwnerIndex(skill,data){return data?.rules?.party?.indexOf(skillOwnerId(skill,data))??-1;}
function skillsForCharacter(data,characterId){return data.skills.filter(skill=>skillOwnerId(skill,data)===characterId);}
function enemy(data,zone,boss,rng=Math.random){const area=data.zones[zone];const pool=data.monsters.filter(e=>e.zoneId===area.id&&!e.boss);const template=boss?data.monsters.find(e=>e.id===area.bossId):pool[Math.floor(rng()*pool.length)];return {...template,hp:template.hp,max:template.hp,boss:!!boss};}
function loot(data,enemy,zone){const template=data.monsters.find(e=>e.id===enemy.id||e.name===enemy.name);const fallback=data.monsters.find(e=>e.zoneId===data.zones[zone].id);return (template||fallback).drops.map(id=>({id,rate:data.rarities.find(r=>r.id===data.materials.find(m=>m.id===id).rarity).rate}));}
function effectAmount(effect,context,combat){switch(effect.type){case'attackBuff':return 0;case'physicalDamage':return combat.physicalDamage({attack:context.attack,defense:context.defense,power:effect.power,roll:context.roll,critical:context.critical});case'magicDamage':case'magicHeal':return combat.magicAmount(context.wisdom,effect);case'restoreHP':return effect.full?context.maxHP:effect.amount;case'restoreMP':return effect.full?context.maxMP:effect.amount;default:throw new Error('未対応の効果: '+effect.type);}}
function skillResult(skill,context,combat){
 const eligible=skill.type==='physical'&&skill.effect==='damage'&&context.attack>0&&skill.effects.some(e=>e.type==='physicalDamage'&&e.power>0);
 const rate=eligible?combat.criticalRate(context.luck):0;
 const critical=rate>0&&(context.criticalRoll??Math.random())<rate;
 return {amount:skill.effects.reduce((total,effect)=>total+effectAmount(effect,{...context,critical},combat),0),critical};
}
function skillAmount(skill,context,combat){return skillResult(skill,context,combat).amount;}
function allyHealth(state,data,index){
 if(index===0)return state.hp;
 const id=data.rules.party[index],members=state.companions||[],identified=members.some(a=>a?.characterId);
 return (members.find(a=>a?.characterId===id)||(!identified?members[index-1]:null))?.hp;
}
function attackBuffEffect(skill){
 const effect=skill?.effects?.[0];
 return skill?.effect==='buff'&&skill.effects?.length===1&&effect?.type==='attackBuff'&&Number.isFinite(effect.multiplier)&&effect.multiplier>1&&effect.multiplier<=3&&Number.isSafeInteger(effect.turns)&&effect.turns>=1&&effect.turns<=99?effect:null;
}
function buffRecord(state,data,record){
 if(!record||typeof record!=='object'||Array.isArray(record))return null;
 const index=data.rules.party.indexOf(record.characterId),skill=data.skills.find(s=>s.id===record.skillId),effect=attackBuffEffect(skill);
 if(index<0||!effect||record.skillId===skill?.id&&skill?.target==='self'&&record.characterId!==skillOwnerId(skill,data)||!(allyHealth(state,data,index)>0)||!Number.isSafeInteger(record.remainingTurns)||record.remainingTurns<1||record.remainingTurns>effect.turns||!Number.isSafeInteger(record.appliedTurn)||record.appliedTurn<1||record.appliedTurn>state.turn)return null;
 return {...record,skill,effect};
}
function validateBuffs(state,data){
 if(state.buffs===undefined)return [];
 if(!Array.isArray(state.buffs)||state.buffs.length>data.rules.party.length)return ['バフの配列が不正です'];
 const errors=[],seen=new Set();
 for(const record of state.buffs){
  if(!state.enemy||!buffRecord(state,data,record)||seen.has(record?.characterId))errors.push('バフの対象・スキル・残りターン・付与ターンが不正です');
  seen.add(record?.characterId);
 }
 return errors;
}
function normalizeBuffs(state,data){
 const seen=new Set();
 state.buffs=!state.enemy||!Array.isArray(state.buffs)?[]:state.buffs.slice(0,data.rules.party.length).filter(record=>{
  if(!buffRecord(state,data,record)||seen.has(record.characterId))return false;
  seen.add(record.characterId);return true;
 }).map(({characterId,skillId,remainingTurns,appliedTurn})=>({characterId,skillId,remainingTurns,appliedTurn}));
 return state.buffs;
}
function activeBuffs(state,data,index){
 if(!state.enemy||!Number.isInteger(index)||index<0||index>=data.rules.party.length)return [];
 const id=data.rules.party[index],seen=new Set();
 return (Array.isArray(state.buffs)?state.buffs:[]).filter(record=>{
  if(record?.characterId!==id||!buffRecord(state,data,record)||seen.has('attackBuff'))return false;
  seen.add('attackBuff');return true;
 }).map(record=>buffRecord(state,data,record));
}
function allyAttack(state,data,index){
 const multiplier=activeBuffs(state,data,index).reduce((value,buff)=>value*buff.effect.multiplier,1);
 return Math.floor(stats(state,data,index).attack*multiplier);
}
function applyAttackBuff(state,data,index,skill,casterIndex=skillOwnerIndex(skill,data)){
 const known=data.skills.find(s=>s.id===skill?.id),effect=attackBuffEffect(known);
 if(!state.enemy||!effect||!Number.isInteger(index)||index<0||index>=data.rules.party.length||!Number.isInteger(casterIndex)||casterIndex<0||casterIndex>=data.rules.party.length||data.rules.party[casterIndex]!==skillOwnerId(known,data)||(known.target==='self'&&index!==casterIndex)||!(allyHealth(state,data,index)>0)||!Number.isSafeInteger(state.turn)||state.turn<1)return false;
 normalizeBuffs(state,data);
 const characterId=data.rules.party[index];
 state.buffs=state.buffs.filter(record=>record.characterId!==characterId);
 state.buffs.push({characterId,skillId:known.id,remainingTurns:effect.turns,appliedTurn:state.turn});return true;
}
function tickBuffs(state,data){
 normalizeBuffs(state,data);const expired=[];
 for(const record of state.buffs){
  if(record.appliedTurn>=state.turn)continue;
  record.remainingTurns--;
  if(record.remainingTurns===0){const skill=data.skills.find(s=>s.id===record.skillId);expired.push({...record,skill,effect:attackBuffEffect(skill)});}
 }
 state.buffs=state.buffs.filter(record=>record.remainingTurns>0);return expired;
}
function travelEvent(rules,fought,roll){if(!fought&&roll<rules.battleRate)return 'battle';if(roll<(fought?rules.materialRate:rules.battleRate+rules.materialRate))return 'material';return 'none';}
return {characterDefaults,memberState,stats,skillOwnerId,skillOwnerIndex,skillsForCharacter,enemy,loot,effectAmount,skillResult,skillAmount,travelEvent,activeBuffs,allyAttack,applyAttackBuff,tickBuffs,normalizeBuffs,validateBuffs};
});
