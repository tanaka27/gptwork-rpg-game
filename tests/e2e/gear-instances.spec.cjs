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
 // 火山で星銀のつるぎ（Lv10）をレジェンダリー・レア・エピックで1本ずつ拾う。
 await page.evaluate(()=>{
  Object.assign(state,{lv:10,zone:2,node:'ash',village:false,journey:null,enemy:null,cleared:[true,true,false]});
  const queue=[0,0,.995,0,.5,1/5,.5,1/4,.5,1/3,.5, 0,0,.85,.2,.5,.6,.5, 0,0,.95,0,.5,0,.5,0,.5];
  for(let i=0;i<3;i++)rollEquipmentDrop({boss:false},()=>queue.shift());render(false);
 });
 const drops=await page.evaluate(()=>state.gear.filter(e=>e.baseId==='star'));
 expect(drops.map(e=>e.rarity)).toEqual(['legendary','rare','epic']);
 expect(drops.map(e=>e.bonusEffects.length)).toEqual([4,2,3]);
 expect(await page.evaluate(()=>state.log.slice(0,3))).toEqual(['星銀のつるぎを発見！［エピック］ もちものから装備できる。','星銀のつるぎを発見！［レア］ もちものから装備できる。','星銀のつるぎを発見！［レジェンダリー］ もちものから装備できる。']);
 await page.locator('[data-screen="bag"]').click();
 const rows=page.locator(bagRow('star'));
 await expect(rows).toHaveCount(3);
 await expect(rows.nth(0).locator('small .rarity.legendary')).toHaveText('レジェンダリー');
 await expect(rows.nth(1).locator('small .rarity.rare')).toHaveText('レア');
 await expect(rows.nth(2).locator('small .rarity.epic')).toHaveText('エピック');
 expect(await rows.nth(0).locator('.gear-image').evaluate(node=>getComputedStyle(node).borderTopColor)).toBe('rgb(232, 191, 108)');
 expect(await rows.nth(1).locator('.gear-image').evaluate(node=>getComputedStyle(node).borderTopColor)).toBe('rgb(165, 140, 230)');
 expect(await rows.nth(2).locator('.gear-image').evaluate(node=>getComputedStyle(node).borderTopColor)).toBe('rgb(223, 116, 180)');
 expect(await rows.nth(2).locator('small .rarity.epic').evaluate(node=>getComputedStyle(node).color)).toBe('rgb(238, 143, 198)');
 // レアリティ順はレジェンダリー→エピック→レア。
 await page.locator('#gearSort').selectOption('rarity');
 await expect(page.locator(bagRow('star')+' small .rarity')).toHaveText(['レジェンダリー','エピック','レア']);
 await page.locator('#gearSort').selectOption('acquired');
 await rows.nth(0).locator('[data-action^="gear-detail:"]').click();
 const detail=page.locator('#inventory .gear-detail');
 await expect(detail.locator('.gear-detail-heading .rarity')).toHaveText('レジェンダリー');
 const labels={maxHP:'最大HP',attack:'攻撃力',defense:'守備力',wisdom:'賢さ',speed:'素早さ',luck:'うんのよさ'};
 await expect(detail.locator('h4:text-is("追加効果") + ul li')).toHaveText(drops[0].bonusEffects.map(e=>`${labels[e.stat]} +${e.amount}`));
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
 await expect(weapon).toContainText('レジェンダリー');await expect(weapon).toContainText('追加効果4');
 await weapon.click();
 await expect(page.locator('#partyDetails [data-gear-detail="star"] li')).toHaveText(drops[0].bonusEffects.map(e=>`${labels[e.stat]} +${e.amount}`));
 expect(await page.evaluate(()=>SaveRules.validate(state,GameData))).toEqual([]);
 await page.reload();await expect(page.locator('html')).toHaveAttribute('data-game-ready','true');
 expect(await page.evaluate(()=>state.gear.filter(e=>e.baseId==='star'))).toEqual(drops);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('もちものの装備を並べ替え・絞り込み、装着中と比べ、街で確認してから売却する',async({page})=>{
 await page.goto('/');await expect(page.locator('html')).toHaveAttribute('data-game-ready','true');
 await page.evaluate(()=>{
  Object.assign(state,{lv:16,node:'home',zone:0,village:true,journey:null,enemy:null,gold:0});
  const rolls=[.995,0,.5,0,.5,0,.5];
  GameRules.addGear(state,GameData,'iron',()=>rolls.shift()??0);GameRules.addGear(state,GameData,'starlight_blade');GameRules.addGear(state,GameData,'leather');render();
 });
 await page.locator('[data-screen="bag"]').click();
 const names=()=>page.locator('#inventory .item:has(.gear-image) strong').allTextContents();
 await page.locator('#gearFilter').selectOption('stored');
 expect(await names()).toEqual(['鉄のつるぎ','星灯りの剣','革のよろい']);
 await page.locator('#gearSort').selectOption('rarity');
 expect(await names()).toEqual(['鉄のつるぎ','星灯りの剣','革のよろい']);
 await page.locator('#gearSort').selectOption('level');
 expect(await names()).toEqual(['星灯りの剣','鉄のつるぎ','革のよろい']);
 await page.locator('#gearFilter').selectOption('armor');
 expect(new Set(await names())).toEqual(new Set(['旅人の服','革のよろい']));
 // 選択はこのブラウザに残る。
 await page.reload();await expect(page.locator('html')).toHaveAttribute('data-game-ready','true');
 await page.locator('[data-screen="bag"]').click();
 await expect(page.locator('#gearSort')).toHaveValue('level');await expect(page.locator('#gearFilter')).toHaveValue('armor');
 await page.locator('#gearFilter').selectOption('stored');
 await page.screenshot({path:test.info().outputPath('gear-list-controls.png')});
 // 比較：アステルの旅人の剣と比べた差を青（上昇）で出す。
 await page.locator('#inventory .item:has([data-gear-id="starlight_blade"]) [data-action^="gear-detail:"]').click();
 const detail=page.locator('#inventory .gear-detail');
 await expect(detail.locator('.gear-compare h4')).toHaveText('アステルの装着中（旅人の剣）と比べて');
 await expect(detail.locator('.gear-compare li')).toHaveText(['攻撃力 +25','素早さ +4','うんのよさ +6']);
 expect(await detail.locator('.gear-compare li').first().evaluate(node=>getComputedStyle(node).color)).toBe('rgb(119, 186, 255)');
 await expect(detail.locator('.gear-sell-note')).toHaveText('売却額 800 G');
 await page.locator('#inventory [data-action="gear-detail-back"]').click();
 // 売却：確認を出し、確定で売る。
 const ironRow=page.locator('#inventory .item:has([data-gear-id="iron"])');
 await ironRow.locator('[data-action^="gear-detail:"]').click();
 await expect(detail.locator('.gear-heading, .gear-detail-heading .rarity')).toHaveText('レジェンダリー');
 await detail.locator('[data-action^="sell-gear:"]').click();
 await expect(detail.locator('[role="status"]')).toHaveText('鉄のつるぎを175 Gで売却しますか？');
 await expect(detail.locator('[data-action^="sell-gear-confirm:"]')).toBeFocused();
 await page.screenshot({path:test.info().outputPath('gear-sell-confirm.png')});
 await detail.locator('[data-action="sell-gear-cancel"]').click();
 await expect(detail.locator('[data-action^="sell-gear-confirm:"]')).toHaveCount(0);
 await detail.locator('[data-action^="sell-gear:"]').click();await detail.locator('[data-action^="sell-gear-confirm:"]').click();
 await expect(page.locator('#inventory .gear-detail')).toHaveCount(0);
 await expect(page.locator('#latestLog')).toHaveText('鉄のつるぎ［レジェンダリー］を175 Gで売却した。');
 expect(await page.evaluate(()=>({gold:state.gold,iron:state.gear.some(e=>e.baseId==='iron'),errors:SaveRules.validate(state,GameData)}))).toEqual({gold:175,iron:false,errors:[]});
 expect(await names()).toEqual(['星灯りの剣','革のよろい']);
 // 装着中の装備と、街の外では売れない。
 await page.locator('#gearFilter').selectOption('weapon');
 await page.locator('#inventory .item:has([data-gear-id="twig"]) [data-action^="gear-detail:"]').first().click();
 await expect(detail.locator('.gear-sell-note')).toHaveText('売却額 10 G（装着中は売れません）');
 await expect(detail.locator('[data-action^="sell-gear"]')).toHaveCount(0);
 await page.locator('#inventory [data-action="gear-detail-back"]').click();
 await page.evaluate(()=>{Object.assign(state,{node:'meadow',village:false});render(false);});
 await page.locator('#inventory .item:has([data-gear-id="starlight_blade"]) [data-action^="gear-detail:"]').click();
 await expect(detail.locator('.gear-sell-note')).toHaveText('売却額 800 G（街で売却できます）');
 await expect(detail.locator('[data-action^="sell-gear"]')).toHaveCount(0);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('旧4段階のレジェンダリー（追加効果3つ）はエピックになり、抽選値を今の範囲に直す',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await expect(page.locator('html')).toHaveAttribute('data-game-ready','true');
 await page.evaluate(()=>{
  const s=JSON.parse(localStorage.getItem('starlight-rpg-v1'));
  s.gear.push({uid:s.nextGearUid,baseId:'star',rarity:'legendary',bonusEffects:[{stat:'attack',amount:3},{stat:'speed',amount:2},{stat:'luck',amount:3}]});
  s.nextGearUid++;s.owned=[...new Set(s.gear.map(e=>e.baseId))];
  localStorage.setItem('starlight-rpg-v1',JSON.stringify(s));
 });
 await page.reload();await expect(page.locator('html')).toHaveAttribute('data-game-ready','true');
 expect(await page.evaluate(()=>state.gear.find(e=>e.baseId==='star'))).toMatchObject({rarity:'epic',bonusEffects:[{stat:'attack',amount:4},{stat:'speed',amount:3},{stat:'luck',amount:4}]});
 await page.locator('[data-screen="bag"]').click();
 await expect(page.locator(bagRow('star')+' small .rarity.epic')).toHaveText('エピック');
 expect(await page.evaluate(()=>SaveRules.validate(JSON.parse(localStorage.getItem('starlight-rpg-v1')),GameData))).toEqual([]);
 await page.screenshot({path:test.info().outputPath('legacy-legendary-epic.png')});
 expect(errors).toEqual([]);
});
