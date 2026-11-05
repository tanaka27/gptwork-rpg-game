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
  for (const screen of ['map', 'bag', 'record', 'adventure']) {
    await page.locator(`[data-screen="${screen}"]`).click();
    await expect(page.locator(`#screen-${screen}`)).toBeVisible();
    await expect(page.locator(`[data-screen="${screen}"]`)).toHaveAttribute('aria-pressed', 'true');
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
