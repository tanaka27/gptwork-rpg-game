// 戦闘メッセージの自動送り・手動切り替えと、独立した「にげる」コマンド
const {test,expect}=require('./fixtures.cjs');
// 既定（設定なし）の自動送りを確認するため、fixtureの手動送り指定を外す。
test.use({messageMode:null});

const ready=async page=>expect(page.locator('html')).toHaveAttribute('data-game-ready','true');
const waitForInput=page=>expect.poll(()=>page.evaluate(()=>!!commandResolve&&!battleMessageResolve),{timeout:20000}).toBe(true);
async function startBattle(page){
 await page.locator('[data-action="explore"]').click();
 await page.evaluate(()=>{state.enemies.forEach(e=>{e.hp=10000;e.max=10000;e.atk=0;});render(false);});
 await waitForInput(page);
}

test('既定では戦闘メッセージを自動で送り、設定で手動に切り替えて保存する',async({page})=>{
 await page.goto('/');await ready(page);
 await expect(page.locator('#messageMode')).toHaveText('メッセージ送り：自動');
 await expect(page.locator('#messageMode')).toHaveAttribute('aria-pressed','true');
 await startBattle(page);
 const first=await page.evaluate(()=>actingAlly);
 await page.locator('[data-action="attack"]').click();
 await expect(page.locator('#messageNext')).toBeVisible();
 await expect(page.locator('#messageNext')).toHaveText('自動で進みます（タップで次へ）▾');
 await expect(page.locator('#latestLog')).toHaveText(/^.+の攻撃！ .+に\d+。$/);
 // クリックしなくても、次の味方の入力待ちまで進む。
 await expect.poll(()=>page.evaluate(first=>!!commandResolve&&actingAlly!==first,first),{timeout:20000}).toBe(true);
 // 自動送り中でもクリックで即座に次へ進める。
 await page.locator('[data-action="attack"]').click();
 const shown=await page.locator('#latestLog').textContent();
 await page.locator('#fieldMessage').click();
 await expect(page.locator('#latestLog')).not.toHaveText(shown);
 await waitForInput(page);
 // 設定メニューで手動送りへ切り替えると、クリックまで進まない。
 await page.locator('.utility-menu summary').click();
 await page.locator('#messageMode').click();
 await expect(page.locator('#messageMode')).toHaveText('メッセージ送り：手動');
 await expect(page.locator('#messageMode')).toHaveAttribute('aria-pressed','false');
 await page.locator('.utility-menu summary').click();
 expect(await page.evaluate(()=>localStorage.getItem('starlight-rpg-message-mode'))).toBe('manual');
 await page.locator('[data-action="attack"]').click();
 await expect(page.locator('#messageNext')).toHaveText('クリック / タップで次へ ▾');
 const manual=await page.locator('#latestLog').textContent();
 await page.waitForTimeout(3000);
 await expect(page.locator('#latestLog')).toHaveText(manual);
 await page.reload();await ready(page);
 await expect(page.locator('#messageMode')).toHaveText('メッセージ送り：手動');
});

test('戦闘コマンドに「にげる」を独立して並べ、ボス戦では無効にする',async({page})=>{
 await page.goto('/');await ready(page);
 await startBattle(page);
 const buttons=page.locator('#actions button');
 await expect(buttons).toHaveText([/こうげき/,/スキル/,/どうぐ/,/ぼうぎょ/,/にげる/]);
 // 5つを1行に並べ、文字を切らない。
 const boxes=await buttons.evaluateAll(nodes=>nodes.map(n=>({y:Math.round(n.getBoundingClientRect().y),fits:n.scrollWidth<=n.clientWidth})));
 expect(new Set(boxes.map(b=>b.y)).size).toBe(1);
 expect(boxes.every(b=>b.fits)).toBe(true);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&document.documentElement.scrollHeight<=innerHeight)).toBe(true);
 await page.screenshot({path:test.info().outputPath('battle-commands.png')});
 // 「どうぐ」の一覧には逃走を出さない。
 await page.locator('[data-action="items"]').click();
 await expect(page.locator('#skillMenu [data-action="run"], #subactions [data-action="run"]')).toHaveCount(0);
 await page.keyboard.press('Escape');
 // ボスを含む戦闘では押せない。
 await page.evaluate(()=>{state.enemies[0].boss=true;render(false);});
 await expect(page.locator('[data-action="run"]')).toBeDisabled();
 await page.evaluate(()=>{state.enemies[0].boss=false;render(false);});
 // 逃走の宣言と結果を1件で表示する。
 await page.evaluate(()=>{Math.random=()=>0;});
 await page.locator('[data-action="run"]').click();
 await expect(page.locator('#latestLog')).toHaveText('旅団は逃走を試みた！ 旅団は逃げきった。');
 await expect(page.locator('.enemy-unit')).toHaveCount(0,{timeout:10000});
 await expect(page.locator('[data-action="explore"]')).toBeVisible();
});
