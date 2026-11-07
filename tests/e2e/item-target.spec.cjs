const {test,expect}=require('@playwright/test');
test('道具で味方を選び、取消・HP/MP回復・戦闘の開始確認を行う',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route(/^https?:\/\/(?!127\.0\.0\.1:4173(?:\/|$))/,r=>r.abort());
 await page.goto('/');await expect(page.locator('html')).toHaveAttribute('data-game-ready','true');
 await page.evaluate(()=>{state.companions[0].hp=1;state.companions[0].mp=0;state.companions[1].hp=0;state.items.potion=1;render();});
 await page.locator('[data-screen="bag"]').click();
 await page.locator('[data-action="use:herb"]:visible').click();
 await expect(page.locator('[data-ally-target="0"]')).toBeDisabled();
 await expect(page.locator('[data-ally-target="2"]')).toBeDisabled();
 await page.screenshot({path:test.info().outputPath('item-targets.png')});
 await page.locator('[data-action="skill-back"]').click();
 expect(await page.evaluate(()=>state.items.herb)).toBe(3);
 await page.evaluate(()=>useItem('herb'));
 await page.locator('[data-ally-target="1"]').click();
 expect(await page.evaluate(()=>[state.hp,state.companions[0].hp,state.items.herb])).toEqual([80,46,2]);
 await page.evaluate(()=>useItem('ether'));
 await page.locator('[data-ally-target="1"]').click();
 expect(await page.evaluate(()=>[state.mp,state.companions[0].mp,state.items.ether])).toEqual([20,18,0]);
 await page.reload();await expect(page.locator('html')).toHaveAttribute('data-game-ready','true');
 expect(await page.evaluate(()=>state.companions[0].hp)).toBe(46);
 await page.locator('[data-action="explore"]').click();
 for(let i=0;i<80&&await page.locator('#messageNext').isVisible();i++)await page.locator('#fieldMessage').click();
 await page.evaluate(()=>{state.companions[0].hp=1;render(false);});
 await page.locator('[data-action="items"]').click();await page.locator('[data-action="use:herb"]:visible').click();
 await page.locator('[data-ally-target="1"]').click();
 expect(await page.evaluate(()=>[state.companions[0].hp,state.items.herb])).toEqual([1,2]);
 await page.locator('#fieldMessage').click();
 expect(await page.evaluate(()=>[state.companions[0].hp,state.items.herb])).toEqual([46,1]);
 await page.screenshot({path:test.info().outputPath('item-healed.png')});
 expect(errors).toEqual([]);
});


