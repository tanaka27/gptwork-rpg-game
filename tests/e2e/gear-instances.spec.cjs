const {test,expect}=require('./fixtures.cjs');
const bagRow=id=>`#inventory .item:has([data-gear-id="${id}"])`;

test('旧セーブの装備を1人1本の個体へ移行し、他の人の装備は交換で付け替える',async({page})=>{
 await page.goto('/');await expect(page.locator('html')).toHaveAttribute('data-game-ready','true');
 // 個体を持たない旧形式：主人公とリナが同じ鉄のつるぎを共有している。
 await page.evaluate(()=>{
  const s=JSON.parse(localStorage.getItem('starlight-rpg-v1'));
  for(const key of ['gear','nextGearUid','weaponUid','armorUid'])delete s[key];
  s.companions.forEach(c=>{delete c.weaponUid;delete c.armorUid;});
  Object.assign(s,{lv:3,weapon:'iron',owned:['twig','cloth','iron','leather'],village:true,node:'home',journey:null,enemy:null});
  s.companions[0].weapon='iron';
  localStorage.setItem('starlight-rpg-v1',JSON.stringify(s));
 });
 await page.reload();await expect(page.locator('html')).toHaveAttribute('data-game-ready','true');
 const stats=await page.evaluate(()=>[0,1,2,3].map(i=>GameRules.stats(state,GameData,i).attack));
 expect(await page.evaluate(()=>({iron:state.gear.filter(e=>e.baseId==='iron').length,leather:state.gear.filter(e=>e.baseId==='leather').length,total:state.gear.length}))).toEqual({iron:2,leather:1,total:9});
 await page.locator('[data-screen="bag"]').click();
 await expect(page.locator('#inventory')).toContainText('装備品（1 / 30本');
 await expect(page.locator(bagRow('iron'))).toHaveCount(2);
 await expect(page.locator(bagRow('iron')).nth(0)).toContainText('アステルが装備中');
 await expect(page.locator(bagRow('iron')).nth(1)).toContainText('リナが装備中');
 await expect(page.locator(bagRow('iron')+' [data-action^="equip:"]').nth(0)).toHaveText('装備中');
 await expect(page.locator(bagRow('iron')+' [data-action^="equip:"]').nth(1)).toHaveText('交換');
 // ガルドが主人公の鉄のつるぎを選ぶと、ガルドの旅人の剣が主人公へ渡る。
 await page.locator('#inventoryCharacter').selectOption('2');
 await page.locator(bagRow('iron')+' [data-action^="equip:"]').nth(0).click();
 expect(await page.evaluate(()=>[state.weapon,state.companions[0].weapon,state.companions[1].weapon])).toEqual(['twig','iron','iron']);
 await expect(page.locator('#latestLog')).toHaveText('ガルドが鉄のつるぎを装備した。（アステルと交換）');
 await expect(page.locator(bagRow('iron')).nth(0)).toContainText('ガルドが装備中');
 await expect(page.locator(bagRow('iron')+' [data-action^="equip:"]').nth(0)).toHaveText('装備中');
 const after=await page.evaluate(()=>[0,1,2,3].map(i=>GameRules.stats(state,GameData,i).attack));
 expect(after[0]).toBe(stats[0]-6);expect(after[2]).toBe(stats[2]+6);expect(after[1]).toBe(stats[1]);
 // 詳細からも交換でき、1本を2人が着けることはない。
 await page.locator('#inventoryCharacter').selectOption('3');
 await page.locator(bagRow('leather')+' [data-action^="gear-detail:"]').click();
 const detail=page.locator('#inventory .gear-detail');
 await expect(detail.locator('[data-action^="equip:"]')).toHaveText('装備');
 await detail.locator('[data-action^="equip:"]').click();
 await expect(detail.locator('[data-action^="equip:"]')).toHaveText('装備中');
 expect(await page.evaluate(()=>{const worn=[state,...state.companions].flatMap(m=>[m.weaponUid,m.armorUid]);return {unique:new Set(worn).size,errors:SaveRules.validate(state,GameData)};})).toEqual({unique:8,errors:[]});
 await detail.locator('[data-action="gear-detail-back"]').click();
 await page.screenshot({path:test.info().outputPath('gear-instances-bag.png')});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 // 再読み込み後も個体と装着を保持する。
 const saved=await page.evaluate(()=>JSON.stringify(state.gear));
 await page.reload();await expect(page.locator('html')).toHaveAttribute('data-game-ready','true');
 expect(await page.evaluate(()=>JSON.stringify(state.gear))).toBe(saved);
 expect(await page.evaluate(()=>[state.weapon,state.companions[1].weapon,state.companions[2].armor])).toEqual(['twig','iron','leather']);
});

test('ドロップした装備は1本ずつ抽選されたレアリティと追加効果を一覧・詳細・キャラクター詳細に表示する',async({page})=>{
 await page.goto('/');await expect(page.locator('html')).toHaveAttribute('data-game-ready','true');
 // 火山で星銀のつるぎ（Lv10）をレジェンダリーとレアで1本ずつ拾う。
 await page.evaluate(()=>{
  Object.assign(state,{lv:10,zone:2,node:'ash',village:false,journey:null,enemy:null,cleared:[true,true,false]});
  const queue=[0,0,.995,0,.5,1/5,.5,1/4,.5, 0,0,.95,.2,.5,.6,.5];
  rollEquipmentDrop({boss:false},()=>queue.shift());rollEquipmentDrop({boss:false},()=>queue.shift());render(false);
 });
 const drops=await page.evaluate(()=>state.gear.filter(e=>e.baseId==='star'));
 expect(drops.map(e=>e.rarity)).toEqual(['legendary','rare']);
 expect(await page.evaluate(()=>state.log.slice(0,2))).toEqual(['星銀のつるぎを発見！［レア］ もちものから装備できる。','星銀のつるぎを発見！［レジェンダリー］ もちものから装備できる。']);
 await page.locator('[data-screen="bag"]').click();
 const rows=page.locator(bagRow('star'));
 await expect(rows).toHaveCount(2);
 await expect(rows.nth(0).locator('small .rarity.legendary')).toHaveText('レジェンダリー');
 await expect(rows.nth(1).locator('small .rarity.rare')).toHaveText('レア');
 expect(await rows.nth(0).locator('.gear-image').evaluate(node=>getComputedStyle(node).borderTopColor)).toBe('rgb(232, 191, 108)');
 expect(await rows.nth(1).locator('.gear-image').evaluate(node=>getComputedStyle(node).borderTopColor)).toBe('rgb(165, 140, 230)');
 await rows.nth(0).locator('[data-action^="gear-detail:"]').click();
 const detail=page.locator('#inventory .gear-detail');
 await expect(detail.locator('.gear-detail-heading .rarity')).toHaveText('レジェンダリー');
 const labels={maxHP:'最大HP',attack:'攻撃力',defense:'守備力',wisdom:'賢さ',speed:'素早さ',luck:'うんのよさ'};
 await expect(detail.locator('li')).toHaveText(drops[0].bonusEffects.map(e=>`${labels[e.stat]} +${e.amount}`));
 await expect(detail.locator('.gear-slot')).toHaveText('武器');
 const before=await page.evaluate(()=>GameRules.stats(state,GameData,0));
 await detail.locator('[data-action^="equip:"]').click();
 const after=await page.evaluate(()=>GameRules.stats(state,GameData,0));
 for(const effect of drops[0].bonusEffects)expect(after[effect.stat]-before[effect.stat]).toBe(effect.amount+(effect.stat==='attack'?14:0));
 await page.screenshot({path:test.info().outputPath('rolled-gear-detail.png')});
 await detail.locator('[data-action="gear-detail-back"]').click();
 await page.screenshot({path:test.info().outputPath('rolled-gear-list.png')});
 // 固有装備の詳細には固定であることを示す。
 await page.evaluate(()=>{GameRules.addGear(state,GameData,'starlight_blade');render(false);});
 await page.locator(bagRow('starlight_blade')+' [data-action^="gear-detail:"]').click();
 await expect(page.locator('#inventory .gear-detail .gear-slot')).toHaveText('武器 · 固有装備（レアリティと追加効果は固定）');
 await page.locator('#inventory [data-action="gear-detail-back"]').click();
 // キャラクター詳細の装備タブにも、着けている個体の値を出す。
 await page.locator('[data-screen="party"]').click();await page.locator('[data-character="0"]').click();
 await page.locator('#partyDetails [data-character-tab="gear"]').click();
 const weapon=page.locator('#partyDetails [data-character-gear]').first();
 await expect(weapon).toContainText('レジェンダリー');await expect(weapon).toContainText('追加効果3');
 await weapon.click();
 await expect(page.locator('#partyDetails [data-gear-detail="star"] li')).toHaveText(drops[0].bonusEffects.map(e=>`${labels[e.stat]} +${e.amount}`));
 expect(await page.evaluate(()=>SaveRules.validate(state,GameData))).toEqual([]);
 await page.reload();await expect(page.locator('html')).toHaveAttribute('data-game-ready','true');
 expect(await page.evaluate(()=>state.gear.filter(e=>e.baseId==='star'))).toEqual(drops);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
