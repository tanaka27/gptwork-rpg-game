const { test, expect } = require('@playwright/test');

async function readBattleRound(page) {
  for(let i=0;i<80;i++){
    if(!await page.locator('#messageNext').isVisible())return;
    await page.locator('#fieldMessage').click();
  }
  throw new Error('Battle messages did not finish');
}

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
  await expect(page.locator('#location')).toBeHidden();
  await expect(page.locator('.scene-description')).toHaveCount(0);
  await expect(page.locator('.arena .field-message #latestLog')).toBeVisible();
  const field=await page.locator('.arena').boundingBox();
  const message=await page.locator('.field-message').boundingBox();
  expect(message.x).toBeGreaterThanOrEqual(field.x);
  expect(message.y).toBeGreaterThanOrEqual(field.y);
  expect(message.x+message.width).toBeLessThanOrEqual(field.x+field.width);
  expect(message.y+message.height).toBeLessThanOrEqual(field.y+field.height);
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
  await readBattleRound(page);
  await expect(page.locator('[data-action="attack"]')).toBeEnabled();
  await expect(page.locator('#turn')).toContainText('2');
  const save = await page.evaluate(() => localStorage.getItem('starlight-rpg-v1'));
  expect(JSON.parse(save).turn).toBe(2);
  await page.reload();
  await expect(page.locator('[data-action="attack"]')).toBeVisible();
  await expect(page.locator('#turn')).toContainText('2');
  expect(await page.evaluate(() => localStorage.getItem('starlight-rpg-v1'))).toBe(save);
});

test('街のお店をその場で開き、品揃え・購入・戻るを操作する', async ({ page }) => {
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  page.on('console',message=>{if(message.type()==='error'&&!message.text().includes('net::ERR_FAILED'))errors.push(message.text());});
  await page.goto('/');
  await page.locator('[data-screen="bag"]').click();
  await expect(page.locator('#screen-bag [data-tab]')).toHaveCount(3);
  await expect(page.locator('[data-tab="shop"]')).toHaveCount(0);
  await expect(page.locator('#inventory [data-action^="buy:"]')).toHaveCount(0);
  await page.locator('[data-screen="adventure"]').click();
  for (const [node, zone, stock, equipment] of [
    ['home', 0, ['herb', 'leather'], 'leather'],
    ['luna', 1, ['herb', 'ether', 'iron', 'leather'], 'iron'],
    ['forge', 2, ['herb', 'ether', 'potion', 'star', 'moon'], 'star'],
  ]) {
    await page.evaluate(({ node, zone }) => {
      const save = JSON.parse(localStorage.getItem('starlight-rpg-v1'));
      Object.assign(save, { node, zone, village: true, enemy: null, journey:null, gold: 1000, cleared: [true, true, false] });
      localStorage.setItem('starlight-rpg-v1', JSON.stringify(save));
    }, { node, zone });
    await page.reload();
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
  await page.reload();await page.locator('[data-action="shop"]').click();
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


test('4対4で素早さ順に行動し、隊列を保存する', async ({ page }) => {
  await page.goto('/');
  await page.locator('[data-action="explore"]').click();
  await expect(page.locator('.party-member')).toHaveCount(4);
  await expect(page.locator('.enemy-unit')).toHaveCount(4);
  await expect(page.locator('#battleOrder')).toContainText('リナ');
  const units=await page.locator('.enemy-unit').evaluateAll(nodes=>nodes.map(n=>({box:n.getBoundingClientRect().toJSON(),svg:n.querySelector('svg').getBoundingClientRect().toJSON()})));
  for(const u of units) expect(u.svg.width).toBeLessThanOrEqual(u.box.width);
  const message=await page.locator('.field-message').boundingBox();
  for(const u of units) expect(u.box.bottom).toBeLessThanOrEqual(message.y);
  await page.locator('[data-action="guard"]').click();
  await readBattleRound(page);
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
  await expect(page.locator('#travelProgress')).toContainText('道中 0 / 3');
  await expect(page.locator('[data-action="rest"]')).toHaveCount(0);
  await page.evaluate(()=>{Math.random=()=>.4;});
  await page.locator('[data-action="travel-next"]').click();
  await expect(page.locator('#latestLog')).toContainText('素材');
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('starlight-rpg-v1')));
  expect(saved.node).toBe('meadow');
  expect(saved.journey.step).toBe(1);
  expect(Object.values(saved.materials).reduce((a,b)=>a+b,0)).toBe(1);
  await page.reload();
  await expect(page.locator('#travelProgress')).toContainText('道中 1 / 3');
  await page.locator('[data-screen="map"]').click();
  await expect(page.locator('#networkMap .travel-road')).toHaveCount(1);
  await expect(page.locator('#regions button:enabled')).toHaveCount(0);
  await page.locator('[data-screen="adventure"]').click();
  await page.locator('[data-action="travel-next"]').click();
  await expect(page.locator('#latestLog')).toContainText('何事もなく');
  await page.evaluate(()=>{Math.random=()=>0;});
  await page.locator('[data-action="travel-next"]').click();
  await expect(page.locator('.enemy-unit')).toHaveCount(4);
  await expect(page.locator('#travelProgress')).toContainText('道中 3 / 3');
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

test('スキル一覧・詳細から上部の味方や敵をクリックして発動する', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(()=>{
    const save=JSON.parse(localStorage.getItem('starlight-rpg-v1'));
    Object.assign(save,{lv:3,hp:114,mp:28});save.companions[0].hp=1;save.companions[1].hp=0;
    localStorage.setItem('starlight-rpg-v1',JSON.stringify(save));
  });
  await page.reload();
  await page.locator('[data-screen="bag"]').click();await page.locator('[data-tab="skills"]').click();
  await page.locator('[data-action="skill:heal"]').click();
  await expect(page.locator('#screen-adventure')).toBeVisible();
  await expect(page.locator('#skillDetail')).toContainText('星のいやし');
  await expect(page.locator('#actions')).toBeHidden();
  await expect(page.locator('[data-ally-target="0"]')).toBeDisabled();
  await expect(page.locator('[data-ally-target="1"]')).toBeEnabled();
  await expect(page.locator('[data-ally-target="2"]')).toBeDisabled();
  await page.locator('[data-action="skill-list"]').click();
  await expect(page.locator('.skill-list')).toBeVisible();
  await page.locator('[data-action="skill-back"]').click();
  await expect(page.locator('#actions')).toBeVisible();
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('starlight-rpg-v1')).mp)).toBe(28);
  await page.locator('[data-screen="bag"]').click();
  await page.locator('[data-action="skill:heal"]').click();await page.locator('[data-ally-target="1"]').click();
  await expect(page.locator('#skillMenu')).toBeHidden();
  let saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('starlight-rpg-v1')));
  expect(saved.companions[0].hp).toBe(53);expect(saved.hp).toBe(114);expect(saved.mp).toBe(23);
  await page.locator('[data-action="explore"]').click();
  await page.evaluate(()=>{
    const save=JSON.parse(localStorage.getItem('starlight-rpg-v1'));
    save.enemies.forEach((e,i)=>{e.name='対象'+i;e.hp=1000;e.max=1000;e.atk=0;});save.enemy=save.enemies[0];
    localStorage.setItem('starlight-rpg-v1',JSON.stringify(save));
  });
  await page.reload();
  await page.locator('[data-action="skills"]').click();
  await expect(page.locator('#actions')).toBeHidden();await expect(page.locator('.skill-list')).toBeVisible();
  await page.locator('[data-action="skill-back"]').click();await expect(page.locator('[data-action="attack"]')).toBeVisible();
  await page.locator('[data-action="skills"]').click();await page.locator('[data-action="skill:flame"]').click();
  await expect(page.locator('#skillDetail')).toContainText('消費MP 4');
  await expect(page.locator('#skillDetail')).toContainText('フィールドの敵');
  await expect(page.locator('#skillTargetDialog')).toHaveCount(0);
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('starlight-rpg-v1')).mp)).toBe(23);
  await page.locator('[data-target="2"]').click();await readBattleRound(page);
  await expect(page.locator('[data-action="attack"]')).toBeEnabled();
  saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('starlight-rpg-v1')));
  expect(saved.enemies[0].hp).toBe(1000);expect(saved.enemies[2].hp).toBeLessThan(1000);
  expect(saved.mp).toBe(19);expect(saved.turn).toBe(2);
});

test('横向きでもスキル一覧・詳細と戻るが画面内に収まる', async ({ page }) => {
  await page.setViewportSize({width:844,height:390});await page.goto('/');
  await page.evaluate(()=>{const save=JSON.parse(localStorage.getItem('starlight-rpg-v1'));Object.assign(save,{lv:7,hp:182,mp:44});save.companions[0].hp=1;localStorage.setItem('starlight-rpg-v1',JSON.stringify(save));});
  await page.reload();await page.locator('[data-action="explore"]').click();await page.locator('[data-action="skills"]').click();
  await expect(page.locator('.skill-list button')).toHaveCount(4);
  for(const selector of ['#skillMenu','[data-action="skill-back"]']){
    const b=await page.locator(selector).boundingBox();expect(b.x).toBeGreaterThanOrEqual(0);expect(b.y).toBeGreaterThanOrEqual(0);expect(b.x+b.width).toBeLessThanOrEqual(844);expect(b.y+b.height).toBeLessThanOrEqual(390);
  }
  await page.locator('[data-action="skill:heal"]').click();await expect(page.locator('#skillDetail')).toBeVisible();
  await page.keyboard.press('Escape');await expect(page.locator('#actions')).toBeVisible();
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('starlight-rpg-v1')).mp)).toBe(44);
});

test('敵は背景枠とHP数値なしのバーで表示し、対象に矢印を付ける', async ({ page }) => {
  await page.goto('/');
  await page.locator('[data-action="explore"]').click();
  await expect(page.locator('#enemy .enemy-hp')).toHaveCount(4);
  for(const style of await page.locator('.enemy-unit').evaluateAll(nodes=>nodes.map(n=>({background:getComputedStyle(n).backgroundColor,border:getComputedStyle(n).borderTopWidth,text:n.innerText})))){
    expect(style.background).toBe('rgba(0, 0, 0, 0)');expect(style.border).toBe('0px');
    expect(style.text).not.toMatch(/HP|速|\d+\s*\//);
  }
  const selected=page.locator('[data-target="2"]');
  await selected.click();
  await expect(selected).toHaveAttribute('aria-pressed','true');
  await expect(selected.locator('.enemy-target-marker')).toBeVisible();
  await expect(page.locator('[data-target="0"] .enemy-target-marker')).toBeHidden();
  const field=await page.locator('.arena').boundingBox();
  const marker=await selected.locator('.enemy-target-marker').boundingBox();
  expect(marker.y).toBeGreaterThanOrEqual(field.y);
  await page.locator('[data-target="0"]').focus();
  await page.keyboard.press('Tab');
  await expect(page.locator('[data-target="1"]')).toBeFocused();
  await expect(page.locator('[data-target="1"] .enemy-target-marker')).toBeVisible();
  await expect(selected.locator('.enemy-target-marker')).toBeHidden();
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-target="1"]')).toHaveAttribute('aria-pressed','true');
  await page.evaluate(()=>{
    const save=JSON.parse(localStorage.getItem('starlight-rpg-v1'));
    save.enemies[1].hp=save.enemies[1].max/2;save.lv=3;save.hp=114;save.mp=28;
    localStorage.setItem('starlight-rpg-v1',JSON.stringify(save));
  });
  await page.reload();
  await expect(page.locator('[data-target="1"] .enemy-hp')).toHaveAttribute('aria-valuenow','50');
  expect(await page.locator('[data-target="1"] .enemy-hp i').evaluate(n=>n.style.width)).toBe('50%');
  await page.locator('[data-action="skills"]').click();
  await page.locator('[data-action="skill:flame"]').click();
  await expect(page.locator('#skillDetail')).toBeVisible();
  await expect(page.locator('#enemy .enemy-hp')).toHaveCount(4);
  await page.locator('[data-action="skill-list"]').click();
  await page.setViewportSize({width:320,height:568});
  await expect.poll(()=>page.evaluate(()=>{
    const field=document.querySelector('.arena').getBoundingClientRect();
    const message=document.querySelector('.field-message').getBoundingClientRect();
    return [...document.querySelectorAll('.enemy-unit')].every(node=>{
      const box=node.getBoundingClientRect();return box.y>=field.y&&box.bottom<=message.y;
    });
  })).toBe(true);
});


test('戦闘メッセージはクリックするまで進まず、キーボードでも送れる', async ({page})=>{
  await page.goto('/');
  await page.locator('[data-action="explore"]').click();
  const save=await page.evaluate(()=>localStorage.getItem('starlight-rpg-v1'));
  await page.locator('[data-action="attack"]').click();
  await expect(page.locator('#messageNext')).toBeVisible();
  const first=await page.locator('#latestLog').textContent();
  await page.waitForTimeout(600);
  await expect(page.locator('#latestLog')).toHaveText(first);
  await expect(page.locator('[data-action="attack"]')).toBeDisabled();
  expect(await page.evaluate(()=>localStorage.getItem('starlight-rpg-v1'))).toBe(save);
  await page.locator('#fieldMessage').click();
  await expect(page.locator('#latestLog')).not.toHaveText(first);
  await expect(page.locator('#turn')).toContainText('1');
  const second=await page.locator('#latestLog').textContent();
  await page.locator('#fieldMessage').focus();await page.keyboard.press('Enter');
  await expect(page.locator('#latestLog')).not.toHaveText(second);
  await readBattleRound(page);
  await expect(page.locator('[data-action="attack"]')).toBeEnabled();
  await expect(page.locator('#messageNext')).toBeHidden();
  await expect(page.locator('#turn')).toContainText('2');
});


test('行動開始を送るまでHPは変わらず、結果を送るまで次の攻撃を反映しない', async ({page})=>{
  await page.goto('/');await page.locator('[data-action="explore"]').click();
  await page.evaluate(()=>{const save=JSON.parse(localStorage.getItem('starlight-rpg-v1'));save.enemies.forEach((e,i)=>{e.name='敵'+i;e.hp=1000;e.max=1000;e.atk=20;e.def=0;});save.enemy=save.enemies[0];localStorage.setItem('starlight-rpg-v1',JSON.stringify(save));});
  await page.reload();
  const hpView=()=>page.locator('#enemy .enemy-hp').evaluateAll(nodes=>nodes.map(n=>({text:n.innerText,html:n.innerHTML,value:n.getAttribute('aria-valuenow')})));
  const view=async()=>({allies:await page.locator('#partyStatus').innerHTML(),bars:await hpView()});
  let previous=await view();
  await page.locator('[data-action="attack"]').click();
  for(let i=0;i<8;i++){
    await expect(page.locator('#latestLog')).toHaveText(/^(リナ|ノエル|アステル|ガルド|敵[0-3])の攻撃！$/);
    expect(await view()).toEqual(previous);
    await page.waitForTimeout(200);
    expect(await view()).toEqual(previous);
    await page.locator('#fieldMessage').click();
    await expect(page.locator('#latestLog')).toContainText(/に[0-9]+。/);
    const result=await view();expect(result).not.toEqual(previous);
    await page.waitForTimeout(200);
    expect(await view()).toEqual(result);
    await page.locator('#fieldMessage').click();previous=result;
  }
  await expect(page.locator('[data-action="attack"]')).toBeEnabled();
  await expect(page.locator('#turn')).toContainText('2');
});


test('行動待機で生存中の敵を薄くせず、攻撃を送った時だけ倒れた敵を薄くする', async ({page})=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  page.on('console',message=>{if(message.type()==='error'&&!message.text().includes('net::ERR_FAILED'))errors.push(message.text());});
  await page.goto('/');
  await expect(page).toHaveTitle('星灯りの旅団 | Starlight Chronicle');
  await expect(page).toHaveURL('http://127.0.0.1:4173/');
  await page.locator('[data-action="explore"]').click();
  await page.evaluate(()=>{
    const save=JSON.parse(localStorage.getItem('starlight-rpg-v1'));
    save.enemies.forEach((e,i)=>{e.name='敵'+i;e.hp=i===0?1:1000;e.max=e.hp;e.atk=0;e.def=0;});
    save.enemy=save.enemies[0];localStorage.setItem('starlight-rpg-v1',JSON.stringify(save));
  });
  await page.reload();
  const target=page.locator('[data-target="0"]');
  await expect(target).toHaveCSS('opacity','1');
  await page.locator('[data-action="attack"]').click();
  await expect(page.locator('#latestLog')).toHaveText('リナの攻撃！');
  for(const enemy of await page.locator('.enemy-unit').all()){
    await expect(enemy).toBeDisabled();
    await expect(enemy).toHaveCSS('opacity','1');
    await expect(enemy).not.toHaveClass(/fallen/);
    await expect(enemy.locator('.enemy-hp')).toHaveAttribute('aria-valuenow','100');
  }
  await page.screenshot({path:test.info().outputPath('before-message-confirmation.png')});
  await page.waitForTimeout(600);
  await expect(target).toHaveCSS('opacity','1');
  await page.locator('#fieldMessage').click();
  await expect(page.locator('#latestLog')).toContainText('敵0に');
  await expect(target).toHaveClass(/fallen/);
  await expect(target).toHaveCSS('opacity','0.4');
  await expect(target.locator('.enemy-hp')).toHaveAttribute('aria-valuenow','0');
  for(const enemy of await page.locator('.enemy-unit:not(.fallen)').all())await expect(enemy).toHaveCSS('opacity','1');
  await page.screenshot({path:test.info().outputPath('after-message-confirmation.png')});
  await page.waitForTimeout(600);
  await expect(page.locator('.enemy-unit.fallen')).toHaveCount(1);
  await page.locator('#fieldMessage').click();
  await expect(page.locator('#latestLog')).toHaveText('敵3の攻撃！');
  for(const enemy of await page.locator('.enemy-unit:not(.fallen)').all())await expect(enemy).toHaveCSS('opacity','1');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&document.documentElement.scrollHeight<=innerHeight)).toBe(true);
  await readBattleRound(page);
  await page.evaluate(()=>{const save=JSON.parse(localStorage.getItem('starlight-rpg-v1'));Object.assign(save,{lv:3,hp:114,mp:28});save.companions[0].hp=1;localStorage.setItem('starlight-rpg-v1',JSON.stringify(save));});
  await page.reload();
  await page.locator('[data-action="skills"]').click();
  await page.locator('[data-action="skill:heal"]').click();
  await expect(page.locator('#skillDetail')).toBeVisible();
  for(const enemy of await page.locator('.enemy-unit:not(.fallen)').all()){
    await expect(enemy).toBeDisabled();await expect(enemy).toHaveCSS('opacity','1');
  }
  expect(errors).toEqual([]);
});
