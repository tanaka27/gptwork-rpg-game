const {test,expect}=require('@playwright/test');
test('4人の顔画像を状態欄・仲間一覧・詳細に表示し、画像から回復対象を選べる',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('net::ERR_FAILED'))errors.push(m.text());});
 await page.route(/^https?:\/\/(?!127\.0\.0\.1:4173(?:\/|$))/,r=>r.abort());
 await page.goto('/');await expect(page.locator('html')).toHaveAttribute('data-game-ready','true');
 const ids=['astel','rina','gald','noel'];
 async function loaded(selector,count){
  await expect(page.locator(selector)).toHaveCount(count);
  await expect.poll(()=>page.locator(selector).evaluateAll(images=>images.every(img=>img.complete&&img.naturalWidth===512&&img.naturalHeight===512))).toBe(true);
 }
 await loaded('#partyStatus .character-portrait',4);
 for(let i=0;i<4;i++)await expect(page.locator('#partyStatus .character-portrait').nth(i)).toHaveAttribute('src',`assets/characters/${ids[i]}.png`);
 await page.screenshot({path:test.info().outputPath('portraits-adventure.png')});
 await page.locator('[data-screen="party"]').click();await loaded('.character-row .character-portrait',4);
 for(let i=0;i<4;i++){
  await page.locator(`[data-character="${i}"] .character-portrait`).click();
  await loaded('#partyDetails .character-portrait',1);
  await expect(page.locator('#partyDetails .character-portrait')).toHaveAttribute('src',`assets/characters/${ids[i]}.png`);
  await page.screenshot({path:test.info().outputPath(`portrait-detail-${ids[i]}.png`)});
  await page.locator('#backToParty').click();
 }
 await page.locator('[data-screen="adventure"]').click();
 await page.evaluate(()=>{state.companions[0].hp=1;render();});
 await page.locator('[data-action="items"]').click();await page.locator('[data-action="use:herb"]:visible').click();
 await page.locator('[data-ally-target="1"] .character-portrait').click();
 expect(await page.evaluate(()=>state.companions[0].hp)).toBe(46);
 await page.locator('[data-action="skill-back"]').click();
 for(const viewport of [{width:320,height:568},{width:844,height:390}]){
  await page.setViewportSize(viewport);await loaded('#partyStatus .character-portrait',4);
  const rectangles=await page.locator('.party-member').evaluateAll(nodes=>nodes.map(node=>({card:node.getBoundingClientRect().toJSON(),image:node.querySelector('img').getBoundingClientRect().toJSON()})));
  for(const {card,image} of rectangles){expect(image.x).toBeGreaterThanOrEqual(card.x);expect(image.y).toBeGreaterThanOrEqual(card.y);expect(image.right).toBeLessThanOrEqual(card.right);expect(image.bottom).toBeLessThanOrEqual(card.bottom);}
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&document.documentElement.scrollHeight<=innerHeight)).toBe(true);
  await page.screenshot({path:test.info().outputPath(`portraits-${viewport.width}.png`)});
 }
 expect(errors).toEqual([]);
});
