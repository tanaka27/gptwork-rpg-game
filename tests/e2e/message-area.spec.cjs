const {test,expect}=require('./fixtures.cjs');
test('背景と無効コマンドの座標でメッセージを一件ずつ送る',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('net::ERR_FAILED'))errors.push(m.text());});
 await page.addInitScript(()=>{Math.random=()=>0;});await page.goto('/');await expect(page.locator('html')).toHaveAttribute('data-game-ready','true');
 await page.locator('[data-action="explore"]').click();await page.locator('[data-action="attack"]').click();
 for(const viewport of [page.viewportSize(),{width:320,height:568},{width:844,height:390}]){
  await page.setViewportSize(viewport);await page.evaluate(()=>render(false));
  await expect(page.locator('.arena #fieldMessage')).toBeVisible();
  const message=await page.locator('#fieldMessage').boundingBox(),party=await page.locator('#partyStatus').boundingBox(),field=await page.locator('.arena').boundingBox();
  expect(message.y).toBeGreaterThanOrEqual(field.y);
  expect(message.y+message.height).toBeLessThanOrEqual(party.y);
  for(const unit of await page.locator('.enemy-unit').all()){
   const box=await unit.boundingBox();expect(box.y).toBeGreaterThanOrEqual(field.y);expect(box.y+box.height).toBeLessThanOrEqual(message.y);
  }
  await page.screenshot({path:test.info().outputPath(`battle-message-${viewport.width}.png`)});
 }
 const clickAt=async(selector)=>{const b=await page.locator(selector).boundingBox();await page.mouse.click(b.x+b.width/2,b.y+b.height/2);};
 const first=await page.locator('#latestLog').textContent();
 await page.screenshot({path:test.info().outputPath('before.png')});
 const arena=await page.locator('.arena').boundingBox();await page.mouse.click(arena.x+8,arena.y+8);
 await expect(page.locator('#latestLog')).not.toHaveText(first);
 const result=await page.locator('#latestLog').textContent();
 await expect(page.locator('[data-action="attack"]')).toBeDisabled();
 await clickAt('[data-action="attack"]');await expect(page.locator('#latestLog')).not.toHaveText(result);
 await require('./party-helpers.cjs').heroInput(page);await page.locator('[data-action="attack"]').click();const next=await page.locator('#latestLog').textContent();await clickAt('[data-action="items"]');await expect(page.locator('#latestLog')).not.toHaveText(next);
 await page.screenshot({path:test.info().outputPath('after.png')});
 for(let i=0;i<80&&await page.locator('#messageNext').isVisible();i++)await page.locator('#fieldMessage').click();
 await expect(page.locator('[data-action="attack"]')).toBeEnabled();
 const input=await page.locator('#latestLog').textContent();await page.mouse.click(arena.x+8,arena.y+8);await expect(page.locator('#latestLog')).toHaveText(input);
 await page.locator('[data-action="guard"]').click();await expect(page.locator('#latestLog')).toContainText('身を守る');
 expect(errors).toEqual([]);
});
