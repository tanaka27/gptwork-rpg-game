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
