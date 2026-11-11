const { test, expect } = require('./fixtures.cjs');

const {heroInput:readBattleRound}=require('./party-helpers.cjs');

test('初期画面、素材画像、4画面切替、ビューポート内表示', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');await expect(page.locator('html')).toHaveAttribute('data-game-ready','true');
  await expect(page).toHaveTitle('星灯りの旅団 | Starlight Chronicle');
  await expect(page.locator('#location')).toHaveText('風そよぐ草原');
  await expect(page.locator('#location')).toBeHidden();
  await expect(page.locator('.scene-description')).toHaveCount(0);
  await expect(page.locator('.command .field-message #latestLog')).toBeVisible();
  const panel=await page.locator('.command').boundingBox();
  const message=await page.locator('.field-message').boundingBox();
  expect(message.x).toBeGreaterThanOrEqual(panel.x);
  expect(message.y).toBeGreaterThanOrEqual(panel.y);
  expect(message.x+message.width).toBeLessThanOrEqual(panel.x+panel.width);
  expect(message.y+message.height).toBeLessThanOrEqual(panel.y+panel.height);
  for (const asset of ['meadow.png', 'village.png']) {
    expect(await page.evaluate(async name => {
      const image = new Image();
      image.src = `/assets/${name}`;
      await image.decode();
      return image.naturalWidth > 0;
    }, asset)).toBe(true);
  }
  const navigation=page.getByRole('navigation',{name:'ゲーム画面'});
  expect(await navigation.ariaSnapshot()).toContain('button "冒険" [pressed]');
  for (const [screen,label] of [['map','地図'],['bag','もちもの'],['party','仲間'],['record','記録'],['adventure','冒険']]) {
    const item=navigation.getByRole('button',{name:label,exact:true});
    await item.click();
    await expect(page.locator(`#screen-${screen}`)).toBeVisible();
    await expect(item).toHaveAttribute('aria-pressed', 'true');
    expect(await page.evaluate(() => (
      document.documentElement.scrollWidth <= innerWidth &&
      document.documentElement.scrollHeight <= innerHeight
    ))).toBe(true);
  }
  expect(errors).toEqual([]);
});

test('下部の仲間ボタンから縦一覧、個別詳細、一覧へ戻る', async ({ page }) => {
  await page.goto('/');await expect(page.locator('html')).toHaveAttribute('data-game-ready','true');
  await page.evaluate(()=>{const save=JSON.parse(localStorage.getItem('starlight-rpg-v1'));save.companions[0].hp=0;save.companions[1].hp=31;localStorage.setItem('starlight-rpg-v1',JSON.stringify(save));});
  await page.reload();await expect(page.locator('html')).toHaveAttribute('data-game-ready','true');await readBattleRound(page);
  await expect(page.locator('.screen-nav button')).toHaveCount(5);
  await page.getByRole('button',{name:'仲間',exact:true}).click();
  await expect(page.locator('#screen-party')).toBeVisible();
  await expect(page.locator('.character-row')).toHaveCount(4);
  await expect(page.locator('#partyDetailView')).toBeHidden();
  const boxes=await page.locator('.character-row').evaluateAll(nodes=>nodes.map(n=>n.getBoundingClientRect().toJSON()));
  for(let i=1;i<boxes.length;i++){expect(boxes[i].y).toBeGreaterThanOrEqual(boxes[i-1].bottom);expect(boxes[i].x).toBe(boxes[0].x);}
  await page.screenshot({path:test.info().outputPath('character-list.png')});
  for(const [i,name,speed] of [[0,'アステル',12],[1,'リナ',18],[2,'ガルド',7],[3,'ノエル',14]]){
    await page.locator(`[data-character="${i}"]`).click();
    await expect(page.locator('#partyListView')).toBeHidden();
    await expect(page.locator('.character-card')).toHaveCount(1);
    await expect(page.locator('#characterName')).toHaveText(name);
    await expect(page.locator('.character-card dd').nth(5)).toHaveText(String(speed));
    if(i===1)await expect(page.locator('.character-card')).toContainText('戦闘不能');
    if(i===2)await expect(page.locator('.character-card dd').first()).toHaveText('31 / 100');
    await page.screenshot({path:test.info().outputPath('character-'+i+'.png')});
    await page.getByRole('button',{name:'← 仲間一覧へ'}).click();
    await expect(page.locator('#partyListView')).toBeVisible();
  }
  await page.locator('[data-character="0"]').click();
  await page.getByRole('button',{name:'冒険',exact:true}).click();
  await page.getByRole('button',{name:'仲間',exact:true}).click();
  await expect(page.locator('#partyListView')).toBeVisible();
});

test('主人公単独の状態欄を削除し、4人の状態は冒険タブだけに表示される', async ({ page }) => {
  await page.goto('/');await expect(page.locator('html')).toHaveAttribute('data-game-ready','true');
  for(const screen of ['adventure','map','bag','party','record','adventure']){
    await page.locator(`.screen-nav [data-screen="${screen}"]`).click();
    await expect(page.locator('.player-strip')).toHaveCount(0);
    for(const selector of ['#partyStatus']){
      if(screen==='adventure') await expect(page.locator(selector)).toBeVisible();
      else await expect(page.locator(selector)).toBeHidden();
    }
    const box=await page.locator(`#screen-${screen}`).boundingBox();
    if(screen!=='adventure') expect(box.y).toBeLessThan(100);
    expect(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight&&document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  }
  await page.getByRole('button',{name:'仲間',exact:true}).click();
  await page.locator('[data-character="0"]').click();
  await expect(page.locator('#partyStatus')).toBeHidden();
  await page.screenshot({path:test.info().outputPath('status-hidden.png')});
});
