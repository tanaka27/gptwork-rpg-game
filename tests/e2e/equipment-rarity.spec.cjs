const {test,expect}=require('./fixtures.cjs');
const {heroInput}=require('./party-helpers.cjs');
const rewardRandoms=()=>[...Array(4).fill(0),...Array(4).fill([0,0,0,0,0,0,.999]).flat()];

test.beforeEach(async({page})=>{
 });

test('uncommon shop gear detail, purchase, inventory detail and bonus stats work',async({page})=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 page.on('console',message=>{if(message.type()==='error'&&!message.text().includes('net::ERR_FAILED'))errors.push(message.text());});
 await page.goto('/');await expect(page.locator('html')).toHaveAttribute('data-game-ready','true');
 await page.evaluate(()=>{const s=JSON.parse(localStorage.getItem('starlight-rpg-v1'));Object.assign(s,{node:'luna',zone:1,village:true,journey:null,enemy:null,lastTown:'luna',gold:1000,cleared:[true,false,false]});localStorage.setItem('starlight-rpg-v1',JSON.stringify(s));});
 await page.reload();await expect(page.locator('html')).toHaveAttribute('data-game-ready','true');
 const before=await page.evaluate(()=>({gold:state.gold,stats:GameRules.stats(state,GameData,0)}));
 await page.locator('[data-action="shop"]').click();
 await expect(page.locator('#shopItems [data-action^="buy:"]')).toHaveCount(5);
 await expect(page.locator('#shopItems')).not.toContainText('レア');await expect(page.locator('#shopItems')).not.toContainText('レジェンダリー');
 await expect(page.locator('#shopItems .item small .rarity.uncommon')).toHaveCount(1);
 await page.locator('#shopItems [data-action="gear-detail:moonsteel_blade"]').click();
 const shopDetail=page.locator('#shopItems .gear-detail');
 await expect(shopDetail.locator('h3')).toBeFocused();await expect(shopDetail).toContainText('アンコモン');await expect(shopDetail.locator('.rarity.uncommon')).toBeVisible();await expect(shopDetail).toContainText('攻撃力 +10');await expect(shopDetail).toContainText('うんのよさ +2');
 await page.screenshot({path:test.info().outputPath('rare-shop-detail.png')});
 await page.locator('#shopItems [data-action="buy:moonsteel_blade"]').click();
 await expect(page.locator('#shopItems [data-action="buy:moonsteel_blade"]')).toBeDisabled();
 expect(await page.evaluate(()=>({gold:state.gold,owned:state.owned.includes('moonsteel_blade')}))).toEqual({gold:before.gold-420,owned:true});
 await page.locator('#shopItems [data-action="gear-detail-back"]').click();await expect(page.locator('#shopItems [data-action="gear-detail:moonsteel_blade"]')).toBeFocused();
 await page.locator('[data-action="shop-close"]').click();await page.locator('[data-screen="bag"]').click();
 await page.locator('#inventory [data-action="gear-detail:moonsteel_blade"]').click();
 const bagDetail=page.locator('#inventory .gear-detail');
 await expect(bagDetail.locator('h3')).toBeFocused();await expect(bagDetail).toContainText('アンコモン');await expect(bagDetail.locator('.rarity.uncommon')).toBeVisible();await expect(bagDetail).toContainText('攻撃力 +10');await expect(bagDetail).toContainText('うんのよさ +2');
 await page.screenshot({path:test.info().outputPath('rare-inventory-detail.png')});
 await page.locator('#inventory [data-action="equip:moonsteel_blade"]').click();
 expect(await page.evaluate(()=>{const s=GameRules.stats(state,GameData,0);return {weapon:state.weapon,attack:s.attack,luck:s.luck};})).toEqual({weapon:'moonsteel_blade',attack:before.stats.attack+10,luck:before.stats.luck+2});
 await expect(page.locator('#inventory [data-action="equip:moonsteel_blade"]')).toBeDisabled();
 await page.locator('#inventory [data-action="gear-detail-back"]').click();
 const gearColors=await page.locator('#inventory .item .rarity').evaluateAll(nodes=>Object.fromEntries(nodes.map(node=>[node.classList[1],getComputedStyle(node).color])));
 await page.locator('[data-tab="materials"]').click();
 const materialColors=await page.locator('#inventory .rarity-guide > span').evaluateAll(nodes=>Object.fromEntries(nodes.map(node=>[node.classList[1],getComputedStyle(node).color])));
 expect(new Set(Object.values(materialColors)).size).toBe(4);expect(materialColors).toMatchObject({common:gearColors.common,uncommon:gearColors.uncommon});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&document.documentElement.scrollHeight<=innerHeight)).toBe(true);
 expect(errors).toEqual([]);
});

test('rare and legendary gear drop through victory, duplicate gear converts to ether and saves by ID',async({page})=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 page.on('console',message=>{if(message.type()==='error'&&!message.text().includes('net::ERR_FAILED'))errors.push(message.text());});
 await page.addInitScript(()=>{let queue=[];Math.random=()=>queue.length?queue.shift():0;window.setRewardRandoms=values=>{queue=[...values];};});
 await page.goto('/');await expect(page.locator('html')).toHaveAttribute('data-game-ready','true');
 await page.evaluate(()=>{const s=JSON.parse(localStorage.getItem('starlight-rpg-v1'));Object.assign(s,{node:'ruins',zone:1,zoneIds:['grassland','moon_ruins','volcano'],village:false,journey:null,enemy:null,lastTown:'luna',cleared:[true,false,false],hp:10000});for(const c of s.companions||[])c.hp=10000;localStorage.setItem('starlight-rpg-v1',JSON.stringify(s));});
 await page.reload();await expect(page.locator('html')).toHaveAttribute('data-game-ready','true');await page.evaluate(()=>GameData.characters.forEach(c=>c.speed=1000));
 await page.locator('[data-action="explore"]').click();await heroInput(page);
 await page.evaluate(randoms=>{state.enemies.forEach(e=>Object.assign(e,{hp:1,max:1,def:0}));state.enemy=state.enemies.find(e=>e.hp>0);setRewardRandoms(randoms);render(false);},rewardRandoms());
 for(let i=0;i<250;i++){
  const flags=await page.evaluate(()=>({input:!!commandResolve,waiting:!!battleMessageResolve,actor:actingAlly,done:!state.enemy&&!busy&&!roundActive}));
  if(flags.done)break;
  if(flags.input)await page.locator('[data-action="attack"]').click();
  else if(flags.waiting)await page.locator('#fieldMessage').click();
  else await page.waitForTimeout(10);
 }
 await expect.poll(()=>page.evaluate(()=>!state.enemy&&!busy&&!roundActive)).toBe(true);
 const firstDrops=await page.evaluate(()=>({zone:state.zone,node:state.node,owned:state.owned,ether:state.items.ether,dropLogs:state.log.filter(line=>line==='星のしずくを拾った！').length}));
 expect(firstDrops).toMatchObject({zone:1,owned:expect.arrayContaining(['eclipse_robe']),ether:4,dropLogs:3});
 await page.locator('[data-screen="bag"]').click();await page.locator('#inventory [data-action="gear-detail:eclipse_robe"]').click();
 const epic=page.locator('#inventory .gear-detail');await expect(epic.locator('h3')).toBeFocused();await expect(epic.locator('.rarity.rare')).toBeVisible();await expect(epic).toContainText('レア');await expect(epic).toContainText('守備力 +13');await expect(epic).toContainText('最大HP +20');await expect(epic).toContainText('賢さ +4');
 await page.screenshot({path:test.info().outputPath('rare-inventory-detail.png')});
 const rareGearColor=await epic.locator('.rarity.rare').evaluate(node=>getComputedStyle(node).color);await page.locator('#inventory [data-action="gear-detail-back"]').click();await page.locator('[data-tab="materials"]').click();const rareMaterialColor=await page.locator('#inventory .rarity-guide .rarity.rare').evaluate(node=>getComputedStyle(node).color);expect(rareGearColor).toBe(rareMaterialColor);await page.locator('[data-tab="bag"]').click();await page.locator('#inventory [data-action="gear-detail:eclipse_robe"]').click();
 const save=await page.evaluate(()=>localStorage.getItem('starlight-rpg-v1'));expect(JSON.parse(save).owned).toContain('eclipse_robe');
 await page.reload();await expect(page.locator('html')).toHaveAttribute('data-game-ready','true');expect(await page.evaluate(()=>state.owned.includes('eclipse_robe'))).toBe(true);
 await page.evaluate(()=>{Object.assign(state,{node:'ash',zone:2,village:false,journey:null,enemy:null,lastTown:'forge'});GameData.characters.forEach(c=>c.speed=1000);render(false);});
 await page.locator('[data-action="explore"]').click();await heroInput(page);
 await page.evaluate(randoms=>{state.enemies.forEach(e=>Object.assign(e,{hp:1,max:1,def:0}));state.enemy=state.enemies.find(e=>e.hp>0);setRewardRandoms(randoms);render(false);},rewardRandoms());
 for(let i=0;i<250;i++){
  const flags=await page.evaluate(()=>({input:!!commandResolve,waiting:!!battleMessageResolve,done:!state.enemy&&!busy&&!roundActive}));
  if(flags.done)break;
  if(flags.input)await page.locator('[data-action="attack"]').click();
  else if(flags.waiting)await page.locator('#fieldMessage').click();
  else await page.waitForTimeout(10);
 }
 await expect.poll(()=>page.evaluate(()=>!state.enemy&&!busy&&!roundActive)).toBe(true);
 expect(await page.evaluate(()=>state.owned.includes('starlight_blade'))).toBe(true);
 expect(await page.evaluate(()=>state.log.some(line=>line.includes('星灯りの剣を発見')))).toBe(true);
 await page.locator('[data-screen="bag"]').click();await page.locator('#inventory [data-action="gear-detail:starlight_blade"]').click();
 const legend=page.locator('#inventory .gear-detail');await expect(legend.locator('.rarity.legendary')).toBeVisible();await expect(legend).toContainText('レジェンダリー');await expect(legend).toContainText('攻撃力 +20');await expect(legend).toContainText('攻撃力 +5');await expect(legend).toContainText('素早さ +4');await expect(legend).toContainText('うんのよさ +6');
 await page.screenshot({path:test.info().outputPath('legendary-inventory-detail.png')});
 const legendaryGearColor=await legend.locator('.rarity.legendary').evaluate(node=>getComputedStyle(node).color);await page.locator('#inventory [data-action="gear-detail-back"]').click();await page.locator('[data-tab="materials"]').click();const legendaryMaterialColor=await page.locator('#inventory .rarity-guide .rarity.legendary').evaluate(node=>getComputedStyle(node).color);expect(legendaryGearColor).toBe(legendaryMaterialColor);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(errors).toEqual([]);
 await page.reload();await expect(page.locator('html')).toHaveAttribute('data-game-ready','true');expect(await page.evaluate(()=>state.owned.includes('starlight_blade'))).toBe(true);
});
