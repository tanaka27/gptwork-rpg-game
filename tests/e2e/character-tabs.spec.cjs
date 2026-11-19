// キャラクター詳細のタブ切り替えと、装備から開く装備詳細
const {test,expect}=require('./fixtures.cjs');
const ready=async page=>expect(page.locator('html')).toHaveAttribute('data-game-ready','true');
const noHorizontalScroll=page=>page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth);

test('仲間の詳細をタブで切り替え、装備を押して装備詳細を開く',async({page})=>{
 await page.goto('/');await ready(page);
 // 追加効果のある装備をリナに着けて表示を確かめる。
 await page.evaluate(()=>{state.lv=12;state.owned.push('moonsteel_blade','eclipse_robe');state.companions[0].weapon='moonsteel_blade';state.companions[0].armor='eclipse_robe';render();});
 await page.locator('[data-screen="party"]').click();await page.locator('[data-character="1"]').click();
 const detail=page.locator('#partyDetails');
 await expect(detail.locator('.character-demographics')).toHaveText('20歳 · 女性');
 const tabs=detail.locator('[role="tab"]');
 await expect(tabs).toHaveText(['能力','装備','特技','状態']);
 await expect(detail.locator('[data-character-tab="stats"]')).toHaveAttribute('aria-selected','true');
 await expect(detail.locator('[role="tabpanel"]:visible')).toHaveCount(1);
 await expect(detail.locator('[data-character-panel="stats"] dt')).toHaveText(['HP','MP','攻撃力','守備力','賢さ','素早さ','うんのよさ','会心率']);
 // 能力タブは、画面下のナビに隠れずに収まる。
 const card=await detail.locator('.character-card').boundingBox(),nav=await page.locator('.screen-nav').boundingBox();
 expect(card.y+card.height).toBeLessThanOrEqual(nav.y);
 expect(await noHorizontalScroll(page)).toBe(true);
 await page.screenshot({path:test.info().outputPath('tab-stats.png')});

 // 装備タブ：武器・防具の一覧から詳細を開き、戻る。
 await detail.locator('[data-character-tab="gear"]').click();
 await expect(detail.locator('[data-character-panel="gear"]')).toBeVisible();
 await expect(detail.locator('[data-character-panel="stats"]')).toBeHidden();
 const rows=detail.locator('[data-character-gear]');
 await expect(rows.locator('strong')).toHaveText(['月鋼の剣','月蝕のローブ']);
 await expect(rows.locator('.gear-image')).toHaveCount(2);
 expect(await rows.nth(0).locator('.gear-image').evaluate(node=>node.getBoundingClientRect().width)).toBe(48);
 await expect(rows.nth(0)).toContainText('アンコモン');await expect(rows.nth(1)).toContainText('追加効果2');
 // アイコン枠はレアリティ色（アンコモン・レア）。
 expect(await rows.locator('.gear-image').evaluateAll(nodes=>nodes.map(node=>getComputedStyle(node).borderTopColor))).toEqual(['rgb(95, 184, 157)','rgb(165, 140, 230)']);
 await page.screenshot({path:test.info().outputPath('tab-gear.png')});
 await rows.nth(1).click();
 const robe=detail.locator('[data-gear-detail="eclipse_robe"]');
 await expect(robe).toBeVisible();
 await expect(robe.locator('.gear-detail-heading [data-gear-id="eclipse_robe"]')).toBeVisible();
 expect(await robe.locator('.gear-detail-heading .gear-image').evaluate(node=>node.getBoundingClientRect().width)).toBe(48);
 await expect(detail.locator('.character-gear-list')).toBeHidden();
 await expect(robe.locator('h3')).toHaveText('月蝕のローブ');await expect(robe.locator('h3')).toBeFocused();
 await expect(robe).toContainText('レア');await expect(robe).toContainText('防具');
 await expect(robe.locator('dl')).toContainText('装備レベルLv.12以上');await expect(robe.locator('dl')).toContainText('基礎補正守備力 +');
 await expect(robe.locator('li')).toHaveText(['最大HP +20','賢さ +4']);
 expect(await noHorizontalScroll(page)).toBe(true);
 await page.screenshot({path:test.info().outputPath('gear-detail.png')});
 await robe.locator('[data-character-gear-back]').click();
 await expect(robe).toBeHidden();await expect(rows.nth(1)).toBeFocused();

 // キー操作：左右・Home・Endでタブを移動する。
 await detail.locator('[data-character-tab="gear"]').focus();
 await page.keyboard.press('ArrowRight');await expect(detail.locator('[data-character-tab="skills"]')).toBeFocused();
 await expect(detail.locator('[data-character-panel="skills"]')).toBeVisible();await expect(detail.locator('.character-skill').first()).toBeVisible();
 await page.keyboard.press('End');await expect(detail.locator('[data-character-tab="status"]')).toHaveAttribute('aria-selected','true');
 await expect(detail.locator('.buff-details')).toBeVisible();
 await page.keyboard.press('ArrowRight');await expect(detail.locator('[data-character-tab="stats"]')).toBeFocused();
 await page.keyboard.press('ArrowLeft');await expect(detail.locator('[data-character-tab="status"]')).toBeFocused();
 await page.keyboard.press('Home');await expect(detail.locator('[data-character-tab="stats"]')).toHaveAttribute('aria-selected','true');

 // 選んだタブは人物を替えても保ち、装備詳細は閉じる。
 await detail.locator('[data-character-tab="gear"]').click();await rows.nth(0).click();
 await page.locator('#backToParty').click();await page.locator('[data-character="2"]').click();
 await expect(detail.locator('[data-character-tab="gear"]')).toHaveAttribute('aria-selected','true');
 await expect(detail.locator('.character-gear-list')).toBeVisible();
 await expect(detail.locator('[data-gear-detail]:visible')).toHaveCount(0);
});

test('冒険画面のステータス表示でもタブと装備詳細を使える',async({page})=>{
 await page.goto('/');await ready(page);
 await page.locator('[data-battle-character="0"]').click();
 const modal=page.locator('#modal');
 await expect(modal).toBeVisible();
 await expect(modal.locator('.character-demographics')).toHaveText('21歳 · 男性');
 await modal.locator('[data-character-tab="gear"]').click();
 await modal.locator('[data-character-gear]').nth(0).click();
 await expect(modal.locator('[data-gear-detail]:visible h3')).toHaveText('旅人の剣');
 await expect(modal.locator('[data-gear-detail]:visible .gear-image')).toHaveCount(1);
 expect(await modal.locator('[data-gear-detail]:visible .gear-image').evaluate(node=>node.getBoundingClientRect().width)).toBe(48);
 await expect(modal.locator('[data-gear-detail]:visible')).toContainText('基礎補正攻撃力 +0');
 expect(await noHorizontalScroll(page)).toBe(true);
 await page.screenshot({path:test.info().outputPath('modal-gear-detail.png')});
 // ターンや状態は変わらず、Escで閉じる。
 const before=await page.evaluate(()=>JSON.stringify(state));
 await page.keyboard.press('Escape');await expect(modal).toBeHidden();
 expect(await page.evaluate(()=>JSON.stringify(state))).toBe(before);
 // 開き直すと装備詳細は閉じた状態から始まる。
 await page.locator('[data-battle-character="1"]').click();
 await expect(modal.locator('[data-character-tab="gear"]')).toHaveAttribute('aria-selected','true');
 await expect(modal.locator('.character-gear-list')).toBeVisible();
});
