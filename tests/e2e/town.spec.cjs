const { test, expect } = require('./fixtures.cjs');

const {heroInput:readBattleRound}=require('./party-helpers.cjs');

test('街のお店をその場で開き、品揃え・購入・戻るを操作する', async ({ page }) => {
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  page.on('console',message=>{if(message.type()==='error'&&!message.text().includes('net::ERR_FAILED'))errors.push(message.text());});
  await page.goto('/');await expect(page.locator('html')).toHaveAttribute('data-game-ready','true');
  await page.locator('[data-screen="bag"]').click();
  await expect(page.locator('#screen-bag [data-tab]')).toHaveCount(3);
  await expect(page.locator('[data-tab="shop"]')).toHaveCount(0);
  await expect(page.locator('#inventory [data-action^="buy:"]')).toHaveCount(0);
  await page.locator('[data-screen="adventure"]').click();
  for (const [node, zone, stock, equipment] of [
    ['home', 0, ['herb', 'leather'], 'leather'],
    ['luna', 1, ['herb', 'ether', 'iron', 'leather', 'moonsteel_blade'], 'iron'],
    ['forge', 2, ['herb', 'ether', 'potion', 'star', 'moon', 'starward_armor'], 'star'],
  ]) {
    await page.evaluate(({ node, zone }) => {
      const save = JSON.parse(localStorage.getItem('starlight-rpg-v1'));
      Object.assign(save, { node, zone, village: true, enemy: null, journey:null, gold: 1000, cleared: [true, true, false] });
      localStorage.setItem('starlight-rpg-v1', JSON.stringify(save));
    }, { node, zone });
    await page.reload();await expect(page.locator('html')).toHaveAttribute('data-game-ready','true');await readBattleRound(page);
    await page.locator('[data-action="shop"]').click();
    await expect(page.locator('#screen-adventure')).toBeVisible();
    await expect(page.locator('#screen-bag')).toBeHidden();
    await expect(page.locator('[data-screen="adventure"]')).toHaveAttribute('aria-pressed','true');
    await expect(page.locator('#actions')).toBeHidden();
    await expect(page.locator('#shopTitle')).toBeFocused();
    await expect(page.locator('#shopMenu [data-action^="buy:"]')).toHaveCount(stock.length);
    for (const id of stock) await expect(page.locator(`#shopItems [data-action="buy:${id}"]`)).toHaveCount(1);
    const before = await page.evaluate(() => JSON.parse(localStorage.getItem('starlight-rpg-v1')));
    await page.locator('#shopItems [data-action="buy:herb"]').click();
    const after=await page.evaluate(() => JSON.parse(localStorage.getItem('starlight-rpg-v1')));
    expect(after.items.herb).toBe(before.items.herb+1);expect(after.gold).toBe(before.gold-12);
    await expect(page.locator('#shopGold')).toHaveText(after.gold+' G');
    await page.locator(`#shopItems [data-action="buy:${equipment}"]`).click();
    await expect(page.locator(`#shopItems [data-action="buy:${equipment}"]`)).toBeDisabled();
    await expect(page.locator(`#shopItems [data-action="buy:${equipment}"]`)).toHaveText('購入済');
    await page.screenshot({path:test.info().outputPath('shop-'+node+'.png')});
    const back=page.locator('[data-action="shop-close"]');
    const box=await back.boundingBox(),viewport=page.viewportSize();
    expect(box.y).toBeGreaterThanOrEqual(0);expect(box.y+box.height).toBeLessThanOrEqual(viewport.height);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&document.documentElement.scrollHeight<=innerHeight)).toBe(true);
    await back.click();
    await expect(page.locator('#shopMenu')).toBeHidden();
    await expect(page.locator('#actions')).toBeVisible();
    await expect(page.locator('[data-action="shop"]')).toBeFocused();
  }
  await page.evaluate(()=>{const save=JSON.parse(localStorage.getItem('starlight-rpg-v1'));save.gold=0;localStorage.setItem('starlight-rpg-v1',JSON.stringify(save));});
  await page.reload();await expect(page.locator('html')).toHaveAttribute('data-game-ready','true');await readBattleRound(page);await page.locator('[data-action="shop"]').click();
  for(const button of await page.locator('#shopItems [data-action^="buy:"]').all())await expect(button).toBeDisabled();
  await page.locator('[data-screen="bag"]').click();
  await expect(page.locator('#shopMenu')).toBeHidden();
  await expect(page.locator('[data-tab="shop"]')).toHaveCount(0);
  await page.locator('[data-screen="adventure"]').click();
  await expect(page.locator('#shopMenu')).toBeHidden();
  await expect(page.locator('[data-action="shop"]')).toBeVisible();
  await page.locator('[data-screen="map"]').click();
  await page.locator('#regions [data-action="move:ash"]').click();
  await expect(page.locator('[data-action="shop"]')).toHaveCount(0);
  await expect(page.locator('#shopMenu')).toBeHidden();
  expect(errors).toEqual([]);
});

test('街名を上部に表示し、宿泊の成功メッセージを街の画面に残さない', async ({page})=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  page.on('console',message=>{if(message.type()==='error'&&!message.text().includes('net::ERR_FAILED'))errors.push(message.text());});
  await page.goto('/');await expect(page.locator('html')).toHaveAttribute('data-game-ready','true');
  for(const [node,zone,name] of [['home',0,'はじまりの村'],['luna',1,'月見の街ルナ'],['forge',2,'鍛冶の街ヴァル']]){
    await page.evaluate(({node,zone})=>{
      const save=JSON.parse(localStorage.getItem('starlight-rpg-v1'));
      Object.assign(save,{node,zone,village:true,enemy:null,journey:null,gold:1000,hp:1,mp:0,cleared:[true,true,false]});
      save.companions.forEach(c=>{c.hp=1;c.mp=0;});
      save.log.unshift('宿屋でひと休み。HP・MPが全回復！');
      localStorage.setItem('starlight-rpg-v1',JSON.stringify(save));
    },{node,zone});
    await page.reload();await expect(page.locator('html')).toHaveAttribute('data-game-ready','true');await readBattleRound(page);
    const title=page.locator('.arena #location');
    await expect(title).toBeVisible();await expect(title).toHaveText(name);
    expect(await title.evaluate(node=>!!node.closest('.field-message'))).toBe(false);
    await expect(page.locator('#fieldMessage')).toBeHidden();
    await expect(page.locator('#latestLog')).toHaveText('');
    await page.locator('[data-action="rest"]').click();
    await expect(title).toHaveText(name);await expect(page.locator('#fieldMessage')).toBeHidden();
    const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('starlight-rpg-v1')));
    expect(saved.hp).toBe(80);expect(saved.mp).toBe(20);expect(saved.gold).toBe(990);
    expect(saved.companions.map(c=>[c.hp,c.mp])).toEqual([[64,24],[100,12],[68,32]]);
    await page.screenshot({path:test.info().outputPath('town-'+node+'.png')});
    await page.reload();await expect(page.locator('html')).toHaveAttribute('data-game-ready','true');await readBattleRound(page);await expect(title).toBeVisible();await expect(page.locator('#fieldMessage')).toBeHidden();
    await page.locator('[data-action="shop"]').click();
    await expect(title).toBeVisible();
    await page.locator('[data-action="buy:herb"]').click();
    await expect(title).toHaveText(name);
    await expect(page.locator('#latestLog')).toContainText('購入した');
    const rects=await page.evaluate(()=>{
      const title=document.querySelector('#location').getBoundingClientRect(),scene=document.querySelector('.arena').getBoundingClientRect(),message=document.querySelector('#fieldMessage').getBoundingClientRect();
      return {title:title.toJSON(),scene:scene.toJSON(),message:message.toJSON()};
    });
    expect(rects.title.y).toBeGreaterThanOrEqual(rects.scene.y);
    expect(rects.title.bottom).toBeLessThanOrEqual(rects.message.y);
    expect(rects.title.right).toBeLessThanOrEqual(rects.scene.right);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&document.documentElement.scrollHeight<=innerHeight)).toBe(true);
    await page.locator('[data-action="shop-close"]').click();
  }
  await page.locator('[data-screen="map"]').click();await page.locator('[data-action="move:ash"]').last().click();
  await expect(page.locator('#location')).toBeHidden();
  await expect(page.locator('#fieldMessage')).toBeVisible();
  expect(errors).toEqual([]);
});
