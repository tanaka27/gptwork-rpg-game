const { test, expect } = require('./fixtures.cjs');

async function expectVisibleTavernImagesLoaded(page) {
  await expect
    .poll(
      () =>
        page.locator('#tavernAdventurerList').evaluate(root => {
          const viewport = root.getBoundingClientRect(),
            visibleRows = [...root.querySelectorAll('.tavern-adventurer')].filter(row => {
              const rect = row.getBoundingClientRect();
              return rect.bottom > viewport.top && rect.top < viewport.bottom;
            });
          return (
            visibleRows.length > 0 &&
            visibleRows.every(row => {
              const image = row.querySelector('.tavern-adventurer-portrait-image');
              return image && image.complete && image.naturalWidth === 512 && image.naturalHeight === 768;
            })
          );
        }),
      { timeout: 10000 }
    )
    .toBe(true);
}

test('酒場で街のNPC冒険者詳細を確認し、探索・道中行動tickを保存する', async ({ page }, testInfo) => {
  await page.addInitScript(() => {
    Math.random = () => 0.99;
  });
  await page.goto('/');
  await expect(page).toHaveTitle('星灯りの旅団 | Starlight Chronicle');
  await expect(page.locator('html')).toHaveAttribute('data-game-ready', 'true');
  await expect(page.locator('#screen-adventure')).toBeVisible();

  await page.evaluate(() => {
    const saved = JSON.parse(localStorage.getItem('starlight-rpg-v1'));
    Object.assign(saved, {
      node: 'home',
      lastTown: 'home',
      zone: 0,
      village: true,
      journey: null,
      enemy: null,
      adventurerState: AdventurerRules.initialState(GameData.nodes),
    });
    localStorage.setItem('starlight-rpg-v1', JSON.stringify(saved));
  });
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-game-ready', 'true');
  await page.locator('[data-action="tavern"]').click();
  await expect(page.locator('#tavernTitle')).toHaveText('はじまりの村の酒場');
  await expect(page.locator('[data-tavern-view="adventurers"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#tavernAdventurerCount')).toHaveText('34人');
  await expect(page.locator('#tavernAdventurerList .tavern-adventurer')).toHaveCount(34);
  const closeButton = page.getByRole('button', { name: '酒場を閉じる' });
  await expect(closeButton).toBeInViewport();
  const closeRect = await closeButton.evaluate(node => node.getBoundingClientRect().toJSON());
  const layout = await page.evaluate(() => {
    const menu = document.querySelector('#tavernMenu').getBoundingClientRect();
    const sidebar = document.querySelector('.tavern-tabs').getBoundingClientRect();
    const list = document.querySelector('#tavernAdventurerList').getBoundingClientRect();
    return { menu: menu.toJSON(), sidebar: sidebar.toJSON(), list: list.toJSON(), bodyHeight: document.documentElement.scrollHeight };
  });
  expect(closeRect.width).toBeGreaterThanOrEqual(44);
  expect(closeRect.height).toBeGreaterThanOrEqual(44);
  expect(closeRect.top).toBeCloseTo(layout.menu.top, 0);
  expect(closeRect.right).toBeCloseTo(layout.menu.right, 0);
  expect(layout.sidebar.right).toBeLessThan(layout.list.left);
  expect(layout.bodyHeight).toBeLessThanOrEqual(await page.evaluate(() => innerHeight));
  const first = page.locator('#tavernAdventurerList .tavern-adventurer').first();
  const firstName = await first.locator('strong').textContent();
  const firstId = (await first.getAttribute('data-action')).split(':')[1];
  const firstImage = first.locator('.tavern-adventurer-portrait-image');
  await expect(firstImage).toHaveAttribute('src', `assets/characters/${firstId}.webp`);
  await expect
    .poll(() => firstImage.evaluate(image => image.complete && image.naturalWidth === 512 && image.naturalHeight === 768))
    .toBe(true);
  await expectVisibleTavernImagesLoaded(page);
  const frame = await first.locator('.tavern-adventurer-portrait').evaluate(node => node.getBoundingClientRect().toJSON());
  expect(frame.width).toBeCloseTo(frame.height, 0);
  await expect(firstImage).toHaveAttribute('loading', 'lazy');
  const crop = await firstImage.evaluate(image => {
    const frame = image.parentElement.getBoundingClientRect(),
      bounds = image.getBoundingClientRect();
    return {
      widthScale: bounds.width / frame.width,
      heightScale: bounds.height / frame.height,
      leftOffset: (bounds.left - frame.left) / frame.width,
      topOffset: (bounds.top - frame.top) / frame.height,
    };
  });
  expect(crop.widthScale).toBeGreaterThan(2);
  expect(crop.heightScale).toBeGreaterThan(3);
  expect(crop.leftOffset).toBeLessThan(-0.5);
  expect(crop.topOffset).toBeGreaterThan(0);
  expect(crop.topOffset).toBeLessThan(0.2);
  const fetchedImage = await page.evaluate(async src => {
    const response = await fetch(src),
      bytes = new Uint8Array(await response.arrayBuffer());
    return {
      status: response.status,
      type: response.headers.get('content-type'),
      signature: Array.from(bytes.slice(0, 4)).map(byte => String.fromCharCode(byte)).join(''),
      format: Array.from(bytes.slice(8, 12)).map(byte => String.fromCharCode(byte)).join(''),
    };
  }, `assets/characters/${firstId}.webp`);
  expect(fetchedImage).toEqual({ status: 200, type: 'image/webp', signature: 'RIFF', format: 'WEBP' });
  await page.screenshot({ path: testInfo.outputPath('tavern-adventurer-list.png') });
  const list = page.locator('#tavernAdventurerList');
  const fixedBefore = await page.evaluate(() => ({
    titleTop: document.querySelector('#tavernTitle').getBoundingClientRect().top,
    tabsTop: document.querySelector('.tavern-tabs').getBoundingClientRect().top,
  }));
  await list.hover();
  await page.mouse.wheel(0, 800);
  await expect.poll(() => list.evaluate(node => node.scrollTop)).toBeGreaterThan(0);
  await expectVisibleTavernImagesLoaded(page);
  await page.screenshot({ path: testInfo.outputPath('tavern-adventurer-list-scrolled.png') });
  await expect(page.locator('#tavernTitle')).toHaveText('はじまりの村の酒場');
  const fixedAfter = await page.evaluate(() => ({
    titleTop: document.querySelector('#tavernTitle').getBoundingClientRect().top,
    tabsTop: document.querySelector('.tavern-tabs').getBoundingClientRect().top,
  }));
  expect(fixedAfter).toEqual(fixedBefore);
  await list.evaluate(node => { node.scrollTop = 0; });
  await first.click();
  await expect(page.locator('#tavernAdventurerDetail')).toBeVisible();
  const detailControls = await page.evaluate(() => {
    const back = document.querySelector('[data-action="adventurer-back"]').getBoundingClientRect();
    const detail = document.querySelector('#tavernAdventurerDetail').getBoundingClientRect();
    const menu = document.querySelector('#tavernMenu').getBoundingClientRect();
    return {
      backTop: back.top,
      backBottom: back.bottom,
      detailTop: detail.top,
      detailBottom: detail.bottom,
      menuTop: menu.top,
      menuBottom: menu.bottom,
      viewportHeight: innerHeight,
    };
  });
  expect(detailControls.backTop).toBeGreaterThanOrEqual(Math.max(detailControls.detailTop, detailControls.menuTop));
  expect(detailControls.backBottom).toBeLessThanOrEqual(
    Math.min(detailControls.detailBottom, detailControls.menuBottom, detailControls.viewportHeight)
  );
  await expect(page.locator('#tavernAdventurerDetailContent h3')).toHaveText(firstName);
  const detailImage = page.locator('.tavern-adventurer-detail-portrait');
  await expect(detailImage).toHaveAttribute('src', `assets/characters/${firstId}.webp`);
  await expect.poll(() => detailImage.evaluate(image => image.complete && image.naturalWidth === 512 && image.naturalHeight === 768)).toBe(true);
  await expect(page.locator('#tavernAdventurerDetailContent')).toContainText('剣士');
  await expect(page.locator('#tavernAdventurerDetailContent')).toContainText('現在地：はじまりの村');
  for (const stat of ['HP', 'MP', '攻撃', '防御', '賢さ', '運', '速さ'])
    await expect(page.locator('#tavernAdventurerDetailContent')).toContainText(stat);
  await page.screenshot({ path: testInfo.outputPath('tavern-adventurer-detail.png') });
  await page.locator('[data-action="adventurer-back"]').click();
  await expect(page.locator('#tavernAdventurerList')).toBeVisible();
  await expect(first).toBeFocused();

  await page.locator('[data-tavern-view="quests"]').click();
  await expect(page.locator('#tavernQuestView')).toBeVisible();
  await expect(page.locator('#tavernQuests .tavern-quest')).toHaveCount(3);
  await expect(page.locator('#tavernQuests')).toContainText('魔物を累計5体倒す');
  await closeButton.click();
  await expect(page.locator('[data-action="tavern"]')).toBeFocused();

  // A location change affects only the town's list; it does not share a live world with another save.
  await page.evaluate(() => {
    const saved = JSON.parse(localStorage.getItem('starlight-rpg-v1'));
    saved.adventurerState.locations.adventurer_001 = 'luna';
    localStorage.setItem('starlight-rpg-v1', JSON.stringify(saved));
  });
  await page.reload();
  await page.locator('[data-action="tavern"]').click();
  await expect(page.locator('#tavernAdventurerCount')).toHaveText('33人');
  await expect(page.locator('[data-action="adventurer-detail:adventurer_001"]')).toHaveCount(0);
  await page.locator('[data-action="tavern-close"]').click();
  await page.evaluate(() => {
    const saved = JSON.parse(localStorage.getItem('starlight-rpg-v1'));
    Object.assign(saved, { node: 'luna', lastTown: 'luna', zone: 1, village: true, cleared: [true, false, false] });
    localStorage.setItem('starlight-rpg-v1', JSON.stringify(saved));
  });
  await page.reload();
  await page.locator('[data-action="tavern"]').click();
  await expect(page.locator('#tavernTitle')).toHaveText('月見の街ルナの酒場');
  await expect(page.locator('#tavernAdventurerCount')).toHaveText('34人');
  await page.locator('[data-action="adventurer-detail:adventurer_001"]').click();
  await expect(page.locator('#tavernAdventurerDetailContent')).toContainText('現在地：月見の街ルナ');
  await page.locator('[data-action="tavern-close"]').click();

  // One tick belongs to each successful road step, not route selection or page reload.
  await page.evaluate(() => {
    const saved = JSON.parse(localStorage.getItem('starlight-rpg-v1'));
    Object.assign(saved, { node: 'meadow', lastTown: 'home', zone: 0, village: false, journey: null, enemy: null });
    saved.adventurerState = AdventurerRules.initialState(GameData.nodes);
    localStorage.setItem('starlight-rpg-v1', JSON.stringify(saved));
  });
  await page.reload();
  await page.locator('[data-screen="map"]').click();
  await page.locator('#regions [data-action="move:home"]').click();
  let progress = await page.evaluate(() => ({ tick: state.adventurerState.tick, step: state.journey.step }));
  expect(progress).toEqual({ tick: 0, step: 0 });
  await page.locator('[data-action="travel-next"]').click();
  progress = await page.evaluate(() => ({ tick: state.adventurerState.tick, step: state.journey.step }));
  expect(progress).toEqual({ tick: 1, step: 1 });
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-game-ready', 'true');
  await expect.poll(() => page.evaluate(() => state.adventurerState.tick)).toBe(1);
  await page.locator('[data-action="travel-next"]').click();
  await page.locator('[data-action="travel-next"]').click();
  await expect(page.locator('#location')).toHaveText('はじまりの村');
  await expect.poll(() => page.evaluate(() => state.adventurerState.tick)).toBe(3);
  await page.screenshot({ path: testInfo.outputPath('adventurer-tick-after-arrival.png') });
});
