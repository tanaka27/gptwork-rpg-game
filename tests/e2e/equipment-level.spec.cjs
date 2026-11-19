const {test,expect}=require('./fixtures.cjs');

const bagRow=id=>`#inventory .item:has([data-gear-id="${id}"])`;
const prepare=async(page,patch)=>{
 await page.goto('/');await expect(page.locator('html')).toHaveAttribute('data-game-ready','true');
 await page.evaluate(patch=>{const s=JSON.parse(localStorage.getItem('starlight-rpg-v1'));Object.assign(s,patch);localStorage.setItem('starlight-rpg-v1',JSON.stringify(s));},patch);
 await page.reload();await expect(page.locator('html')).toHaveAttribute('data-game-ready','true');
};

test('equipment level is shown in shop, bag and detail and gates equipping by party level',async({page})=>{
 await prepare(page,{lv:7,node:'luna',zone:1,village:true,journey:null,enemy:null,lastTown:'luna',gold:1000,cleared:[true,false,false]});
 await page.locator('[data-action="shop"]').click();
 const shopRow=page.locator('#shopItems .item:has([data-action="buy:moonsteel_blade"])');
 await expect(shopRow).toContainText('装備Lv.8');await expect(shopRow.locator('.gear-level.insufficient')).toBeVisible();
 await expect(page.locator('#shopItems .item:has([data-action="buy:iron"]) .gear-level')).not.toHaveClass(/insufficient/);
 await page.locator('#shopItems [data-action="buy:moonsteel_blade"]').click();
 await expect(shopRow).toContainText('所持1');await expect(page.locator('#shopItems [data-action="buy:moonsteel_blade"]')).toHaveText('420 G');
 await page.locator('[data-action="shop-close"]').click();await page.locator('[data-screen="bag"]').click();
 const bagEquip=page.locator(bagRow('moonsteel_blade')+' [data-action^="equip:"]');
 await expect(bagEquip).toHaveText('Lv不足');await expect(bagEquip).toBeDisabled();
 await bagEquip.scrollIntoViewIfNeeded();await page.screenshot({path:test.info().outputPath('equipment-level-bag.png')});
 for(const index of ['1','3']){await page.locator('#inventoryCharacter').selectOption(index);await expect(bagEquip).toBeDisabled();}
 await page.locator('#inventoryCharacter').selectOption('0');
 await page.locator(bagRow('moonsteel_blade')+' [data-action^="gear-detail:"]').click();
 const detail=page.locator('#inventory .gear-detail');
 await expect(detail).toContainText('装備レベル');await expect(detail.locator('dd .gear-level')).toHaveText('Lv.8');await expect(detail).toContainText('Lv.8以上');
 await expect(detail.locator('.gear-level-note')).toHaveText('旅団がLv.8になると装備できます（現在Lv.7）。');
 await expect(detail.locator('[data-action^="equip:"]')).toBeDisabled();
 await page.screenshot({path:test.info().outputPath('equipment-level-locked.png')});
 expect(await page.evaluate(()=>{action('equip:moonsteel_blade');return {weapon:state.weapon,log:state.log.includes('月鋼の剣は旅団Lv.8から装備できます。')};})).toEqual({weapon:'twig',log:true});
 await page.evaluate(()=>{state.lv=8;render();});
 await expect(detail.locator('.gear-level-note')).toHaveCount(0);
 await detail.locator('[data-action^="equip:"]').click();
 await expect(detail.locator('[data-action^="equip:"]')).toHaveText('装備中');
 await page.screenshot({path:test.info().outputPath('equipment-level-equipped.png')});
 expect(await page.evaluate(()=>state.weapon)).toBe('moonsteel_blade');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('existing saves keep over-level gear equipped but cannot re-equip it until the level is reached',async({page})=>{
 await prepare(page,{lv:2,weapon:'starlight_blade',owned:['twig','cloth','iron','starlight_blade']});
 expect(await page.evaluate(()=>state.weapon)).toBe('starlight_blade');
 await page.locator('[data-screen="bag"]').click();
 const blade=page.locator(bagRow('starlight_blade')+' [data-action^="equip:"]');
 await expect(blade).toHaveText('装備中');
 await expect(page.locator(bagRow('starlight_blade')+' .gear-level.insufficient')).toHaveText('装備Lv.16');
 // 主人公が着けていない旅人の剣（移行で残った1本）は先頭の行。
 await expect(page.locator(bagRow('twig')+' [data-action^="equip:"]').first()).toHaveText('装備');
 await page.locator(bagRow('twig')+' [data-action^="equip:"]').first().click();
 await expect(blade).toHaveText('Lv不足');
 await expect(blade).toBeDisabled();
 await page.reload();await expect(page.locator('html')).toHaveAttribute('data-game-ready','true');
 expect(await page.evaluate(()=>state.weapon)).toBe('twig');
});
