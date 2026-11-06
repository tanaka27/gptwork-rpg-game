(function(root,factory){const api=factory();if(typeof module==='object')module.exports=api;else root.GameContent=api;})(typeof globalThis!=='undefined'?globalThis:this,()=>{
'use strict';
const categories=['characters','zones','monsters','items','skills','nodes','rarities','materials','shops'];
const effectTypes=['physicalDamage','magicDamage','magicHeal','restoreHP','restoreMP'];
const safeId=id=>typeof id==='string'&&/^[a-z][a-z0-9_-]{0,63}$/.test(id);
function validate(data){
 const errors=[];const add=(path,message)=>errors.push(path+': '+message);
 if(!data||typeof data!=='object'||data.schemaVersion!==1)return ['schemaVersion: 1の定義データが必要です'];
 const indexes={};
 function safeText(value,path){if(typeof value==='string'&&/[<>]/.test(value))add(path,'HTMLの山括弧は使用できません');else if(Array.isArray(value))value.forEach((v,i)=>safeText(v,path+'['+i+']'));else if(value&&typeof value==='object')for(const [key,v]of Object.entries(value))safeText(v,path+'.'+key);}
 safeText(data,'content');
 for(const key of categories){
  if(!Array.isArray(data[key])||!data[key].length){add(key,'空でない配列が必要です');indexes[key]=new Set();continue;}
  const ids=indexes[key]=new Set();
  data[key].forEach((entry,i)=>{const path=key+'['+i+']';if(!entry||typeof entry!=='object'){add(path,'オブジェクトが必要です');return;}
   if(!safeId(entry.id)||ids.has(entry.id))add(path+'.id','IDが不正または重複しています');ids.add(entry.id);
   if(key!=='shops'&&(typeof entry.name!=='string'||!entry.name.trim()||entry.name.length>100))add(path+'.name','1〜100文字の名前が必要です');
   for(const field of ['hp','atk','def','wis','xp','gold','speed','price','value','cost','lv','kills'])if(field in entry&&(!Number.isSafeInteger(entry[field])||entry[field]<0||entry[field]>100000000))add(path+'.'+field,'範囲内の数値が必要です');
  });
 }
 if(errors.length)return errors;
 const ref=(key,id,path)=>{if(!indexes[key]?.has(id))add(path,'参照先がありません: '+String(id));};
 const effects=(entry,path)=>{if(!Array.isArray(entry.effects)||!entry.effects.length){add(path+'.effects','効果を1つ以上指定してください');return;}
  entry.effects.forEach((effect,i)=>{if(!effect||!effectTypes.includes(effect.type)){add(path+'.effects['+i+']','未対応の効果です');return;}
   if(['restoreHP','restoreMP'].includes(effect.type)&&!effect.full&&(!Number.isFinite(effect.amount)||effect.amount<0))add(path+'.effects['+i+'].amount','回復量が必要です');
   for(const field of ['amount','base','power'])if(effect[field]!=null&&(!Number.isFinite(effect[field])||effect[field]<0||effect[field]>100000000))add(path+'.effects['+i+'].'+field,'非負の数値が必要です');
  });};
 for(const e of data.characters||[])if(!Number.isFinite(e.speed)||e.speed<0)add('characters.'+e.id+'.speed','素早さが必要です');
 for(const e of data.monsters||[]){ref('zones',e.zoneId,'monsters.'+e.id+'.zoneId');if(!Number.isFinite(e.hp)||e.hp<=0)add('monsters.'+e.id+'.hp','HPは正の値が必要です');if(!Array.isArray(e.drops))add('monsters.'+e.id+'.drops','素材IDの配列が必要です');else e.drops.forEach(id=>ref('materials',id,'monsters.'+e.id+'.drops'));}
 for(const e of data.zones||[])ref('monsters',e.bossId,'zones.'+e.id+'.bossId');
 for(const e of data.nodes||[]){ref('zones',e.zoneId,'nodes.'+e.id+'.zoneId');if(!Array.isArray(e.links))add('nodes.'+e.id+'.links','接続先の配列が必要です');else for(const id of e.links){ref('nodes',id,'nodes.'+e.id+'.links');const other=data.nodes.find(n=>n.id===id);if(other&&!other.links?.includes(e.id))add('nodes.'+e.id+'.links','接続は双方向にしてください: '+id);}}
 for(const e of data.materials||[])ref('rarities',e.rarity,'materials.'+e.id+'.rarity');
 for(const e of data.rarities||[])if(!Number.isFinite(e.rate)||e.rate<0||e.rate>1)add('rarities.'+e.id+'.rate','確率は0〜1です');
 for(const e of data.shops||[]){ref('nodes',e.nodeId,'shops.'+e.id+'.nodeId');if(!data.nodes?.find(n=>n.id===e.nodeId)?.town)add('shops.'+e.id,'街にだけお店を配置できます');if(!Array.isArray(e.itemIds))add('shops.'+e.id+'.itemIds','商品IDの配列が必要です');else e.itemIds.forEach(id=>ref('items',id,'shops.'+e.id+'.itemIds'));}
 for(const e of data.skills||[]){effects(e,'skills.'+e.id);if(!['damage','heal'].includes(e.effect)||!['physical','magic'].includes(e.type))add('skills.'+e.id,'攻撃/回復と物理/魔法の分類が必要です');for(const effect of e.effects||[])if(e.effect==='heal'?effect.type!=='magicHeal':!['physicalDamage','magicDamage'].includes(effect.type))add('skills.'+e.id+'.effects','対象の種類と効果が一致しません');}
 for(const e of data.items||[]){if(!['gear','consumable'].includes(e.category))add('items.'+e.id+'.category','gearまたはconsumableが必要です');if(e.category==='consumable')effects(e,'items.'+e.id);else if(!['weapon','armor'].includes(e.type))add('items.'+e.id+'.type','weaponまたはarmorが必要です');}
 const r=data.rules;if(!r?.growth||!r.travel||!r.battle||!r.inn)add('rules','成長・道中・戦闘・宿屋の設定が必要です');
 else {if(!r.normalAttack||!Number.isFinite(r.normalAttack.power)||r.normalAttack.power<0)add('rules.normalAttack','通常攻撃の倍率が必要です');if(!Number.isSafeInteger(r.battle.guardMPRestore)||r.battle.guardMPRestore<0)add('rules.battle.guardMPRestore','防御時のMP回復量が必要です');for(const key of ['baseHP','hpPerLevel','baseMP','mpPerLevel','baseAttack','attackPerLevel','baseDefense','defensePerLevel','baseWisdom','wisdomPerLevel','baseExperience','experiencePerLevel','maxLevel'])if(!Number.isSafeInteger(r.growth[key])||r.growth[key]<0)add('rules.growth.'+key,'非負の整数が必要です');if(!r.growth.baseHP||!r.growth.maxLevel)add('rules.growth','HPとレベル上限は1以上です');if(!Number.isInteger(r.battle.strongEvery)||r.battle.strongEvery<1)add('rules.battle.strongEvery','1以上の整数が必要です');if(!Number.isSafeInteger(r.inn.price)||r.inn.price<0)add('rules.inn.price','宿代は非負の整数です');for(const [section,values]of Object.entries(r)){for(const [key,value]of Object.entries(values))if(typeof value==='number'&&(!Number.isFinite(value)||value<0))add('rules.'+section+'.'+key,'非負の数値が必要です');}
 if(!Number.isInteger(r.travel.steps)||r.travel.steps<1)add('rules.travel.steps','1以上の整数が必要です');
 for(const [section,key]of [['travel','battleRate'],['travel','materialRate'],['battle','escapeRate'],['battle','rescueRate']])if(!(r[section][key]>=0&&r[section][key]<=1))add('rules.'+section+'.'+key,'0〜1の値が必要です');
 if(!Array.isArray(r.party)||r.party.length!==4)add('rules.party','初期隊列には4人のIDを指定してください');else r.party.forEach(id=>ref('characters',id,'rules.party'));for(const zone of data.zones||[]){if(zone.travelMaterials&&(!Array.isArray(zone.travelMaterials)||!zone.travelMaterials.length))add('zones.'+zone.id+'.travelMaterials','素材を1つ以上指定してください');else for(const id of zone.travelMaterials||[])ref('materials',id,'zones.'+zone.id+'.travelMaterials');if(!data.monsters?.some(e=>e.zoneId===zone.id&&!e.boss))add('zones.'+zone.id,'通常の敵を1体以上登録してください');}
 }
 return errors;
}
function legacy(data){const errors=validate(data);if(errors.length)throw new Error(errors.join('\n'));const dict=rows=>Object.fromEntries(rows.map(e=>[e.id,{...e}]));const zoneIndex=id=>data.zones.findIndex(z=>z.id===id);
 return {zones:data.zones,gear:dict(data.items.filter(e=>e.category==='gear')),consumables:dict(data.items.filter(e=>e.category==='consumable')),shopStock:Object.fromEntries(data.shops.map(e=>[e.nodeId,e.itemIds])),skillList:data.skills,mapNodes:data.nodes.map(e=>({...e,zone:zoneIndex(e.zoneId)})),rarities:dict(data.rarities),materials:dict(data.materials),bestiary:data.zones.map(z=>data.monsters.filter(e=>e.zoneId===z.id&&!e.boss)),normalAttack:data.rules.normalAttack};}
return {validate,legacy,categories,effectTypes};
});
