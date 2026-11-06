const { test, expect } = require('@playwright/test');

test.beforeEach(async ({ page }) => {
  // 外部フォントに左右されず、ローカルの配信物だけを検証する。
  await page.route(/^https?:\/\/(?!127\.0\.0\.1:4173(?:\/|$))/, route => route.abort());
});

test('初期画面、素材画像、4画面切替、ビューポート内表示', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page).toHaveTitle('星灯りの旅団 | Starlight Chronicle');
  await expect(page.locator('#location')).toHaveText('風そよぐ草原');
  for (const asset of ['meadow.png', 'village.png']) {
    expect(await page.evaluate(async name => {
      const image = new Image();
      image.src = `/assets/${name}`;
      await image.decode();
      return image.naturalWidth > 0;
    }, asset)).toBe(true);
  }
  for (const screen of ['map', 'bag', 'party', 'record', 'adventure']) {
    await page.locator(`.screen-nav [data-screen="${screen}"]`).click();
    await expect(page.locator(`#screen-${screen}`)).toBeVisible();
    await expect(page.locator(`.screen-nav [data-screen="${screen}"]`)).toHaveAttribute('aria-pressed', 'true');
    expect(await page.evaluate(() => (
      document.documentElement.scrollWidth <= innerWidth &&
      document.documentElement.scrollHeight <= innerHeight
    ))).toBe(true);
  }
  expect(errors).toEqual([]);
});

test('探索から攻撃で敵ターンへ進み、再読込で進行を保持する', async ({ page }) => {
  await page.goto('/');
  await page.locator('[data-action="explore"]').click();
  await expect(page.locator('[data-action="attack"]')).toBeVisible();
  await page.locator('[data-action="attack"]').click();
  await expect(page.locator('[data-action="attack"]')).toBeEnabled();
  await expect(page.locator('#turn')).toContainText('2');
  const save = await page.evaluate(() => localStorage.getItem('starlight-rpg-v1'));
  expect(JSON.parse(save).turn).toBe(2);
  await page.reload();
  await expect(page.locator('[data-action="attack"]')).toBeVisible();
  await expect(page.locator('#turn')).toContainText('2');
  expect(await page.evaluate(() => localStorage.getItem('starlight-rpg-v1'))).toBe(save);
});

test('街ごとの品揃えと購入、街の外での購入拒否', async ({ page }) => {
  await page.goto('/');
  for (const [node, zone, stock] of [
    ['home', 0, ['herb', 'leather']],
    ['luna', 1, ['herb', 'ether', 'iron', 'leather']],
    ['forge', 2, ['herb', 'ether', 'potion', 'star', 'moon']],
  ]) {
    await page.evaluate(({ node, zone }) => {
      const save = JSON.parse(localStorage.getItem('starlight-rpg-v1'));
      Object.assign(save, { node, zone, village: true, enemy: null, gold: 1000, cleared: [true, true, false] });
      localStorage.setItem('starlight-rpg-v1', JSON.stringify(save));
    }, { node, zone });
    await page.reload();
    await page.locator('[data-action="shop"]').click();
    await expect(page.locator('#inventory [data-action^="buy:"]')).toHaveCount(stock.length);
    for (const id of stock) await expect(page.locator(`[data-action="buy:${id}"]`)).toBeVisible();
    const herbs = await page.evaluate(() => JSON.parse(localStorage.getItem('starlight-rpg-v1')).items.herb);
    await page.locator('[data-action="buy:herb"]').click();
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('starlight-rpg-v1')).items.herb)).toBe(herbs + 1);
  }
  await page.locator('[data-screen="map"]').click();
  await page.locator('#regions [data-action="move:ash"]').click();
  await page.locator('[data-screen="bag"]').click();
  await page.locator('[data-tab="shop"]').click();
  await expect(page.locator('#inventory')).toContainText('お店は街で利用できます');
  await expect(page.locator('#inventory [data-action^="buy:"]')).toHaveCount(0);
});


test('4対4で素早さ順に行動し、隊列を保存する', async ({ page }) => {
  await page.goto('/');
  await page.locator('[data-action="explore"]').click();
  await expect(page.locator('.party-member')).toHaveCount(4);
  await expect(page.locator('.enemy-unit')).toHaveCount(4);
  await expect(page.locator('#battleOrder')).toContainText('リナ');
  const units=await page.locator('.enemy-unit').evaluateAll(nodes=>nodes.map(n=>({box:n.getBoundingClientRect().toJSON(),svg:n.querySelector('svg').getBoundingClientRect().toJSON()})));
  for(const u of units) expect(u.svg.width).toBeLessThanOrEqual(u.box.width);
  await page.locator('[data-action="guard"]').click();
  await expect(page.locator('[data-action="guard"]')).toBeEnabled();
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('starlight-rpg-v1')));
  expect(saved.lastRoundOrder[0]).toBe('リナ');
  expect(saved.lastRoundOrder.length).toBeGreaterThan(4);
  expect(saved.companions).toHaveLength(3);
  expect(saved.enemies).toHaveLength(4);
  await page.reload();
  await expect(page.locator('.enemy-unit')).toHaveCount(4);
  await page.screenshot({path: test.info().outputPath('party-battle.png')});
});



test('下部の仲間ボタンから縦一覧、個別詳細、一覧へ戻る', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(()=>{const save=JSON.parse(localStorage.getItem('starlight-rpg-v1'));save.companions[0].hp=0;save.companions[1].hp=31;localStorage.setItem('starlight-rpg-v1',JSON.stringify(save));});
  await page.reload();
  await expect(page.locator('.screen-nav button')).toHaveCount(5);
  await page.getByRole('button',{name:'仲間',exact:true}).click();
  await expect(page.locator('#screen-party')).toBeVisible();
  await expect(page.locator('.character-row')).toHaveCount(4);
  await expect(page.locator('#partyDetailView')).toBeHidden();
  const boxes=await page.locator('.character-row').evaluateAll(nodes=>nodes.map(n=>n.getBoundingClientRect().toJSON()));
  for(let i=1;i<boxes.length;i++){expect(boxes[i].y).toBeGreaterThanOrEqual(boxes[i-1].bottom);expect(boxes[i].x).toBe(boxes[0].x);}
  await page.screenshot({path:test.info().outputPath('character-list.png')});
  for(const [i,name,speed] of [[0,'アステル',12],[1,'リナ',18],[2,'ガルド',7],[3,'ノエル',14]]){
    await page.getByRole('button',{name:name+'のステータスを見る'}).click();
    await expect(page.locator('#partyListView')).toBeHidden();
    await expect(page.locator('.character-card')).toHaveCount(1);
    await expect(page.locator('#characterName')).toHaveText(name);
    await expect(page.locator('.character-card dd').nth(5)).toHaveText(String(speed));
    if(i===1)await expect(page.locator('.character-card')).toContainText('戦闘不能');
    if(i===2)await expect(page.locator('.character-card dd').first()).toHaveText('31 / 80');
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
  await page.goto('/');
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

test('地図から3工程の道中へ出発し、素材・戦闘・保存再開を経て街に到着する', async ({ page }) => {
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(()=>{Math.random=()=>.99;});
  await page.goto('/');
  await page.locator('[data-screen="map"]').click();
  await page.locator('#regions [data-action="move:home"]').click();
  await expect(page.locator('#screen-adventure')).toBeVisible();
  await expect(page.locator('#location')).toHaveText('風そよぐ草原 → はじまりの村');
  await expect(page.locator('#sceneCaption')).toContainText('道中 0 / 3');
  await expect(page.locator('[data-action="rest"]')).toHaveCount(0);
  await page.evaluate(()=>{Math.random=()=>.4;});
  await page.locator('[data-action="travel-next"]').click();
  await expect(page.locator('#latestLog')).toContainText('素材');
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('starlight-rpg-v1')));
  expect(saved.node).toBe('meadow');
  expect(saved.journey.step).toBe(1);
  expect(Object.values(saved.materials).reduce((a,b)=>a+b,0)).toBe(1);
  await page.reload();
  await expect(page.locator('#sceneCaption')).toContainText('道中 1 / 3');
  await page.locator('[data-screen="map"]').click();
  await expect(page.locator('#networkMap .travel-road')).toHaveCount(1);
  await expect(page.locator('#regions button:enabled')).toHaveCount(0);
  await page.locator('[data-screen="adventure"]').click();
  await page.locator('[data-action="travel-next"]').click();
  await expect(page.locator('#latestLog')).toContainText('何事もなく');
  await page.evaluate(()=>{Math.random=()=>0;});
  await page.locator('[data-action="travel-next"]').click();
  await expect(page.locator('.enemy-unit')).toHaveCount(4);
  await expect(page.locator('#sceneCaption')).toContainText('道中 3 / 3');
  await expect(page.locator('[data-action="travel-next"]')).toHaveCount(0);
  await page.reload();
  await expect(page.locator('.enemy-unit')).toHaveCount(4);
  await page.evaluate(()=>{Math.random=()=>0;});
  await page.locator('[data-action="items"]').click();
  await page.locator('[data-action="run"]').click();
  await expect(page.locator('#location')).toHaveText('はじまりの村');
  await expect(page.locator('[data-action="rest"]')).toBeVisible();
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('starlight-rpg-v1')).journey)).toBeNull();
  expect(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight&&document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});
