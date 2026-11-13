const {test,expect}=require('./fixtures.cjs');
const {heroInput:advanceToInput}=require('./party-helpers.cjs');
const ready=page=>expect(page.locator('html')).toHaveAttribute('data-game-ready','true',{timeout:15000});
const critText='。うんのよさが高いほど会心の一撃が出やすく、会心の一撃は相手の守備力を無視します。';

test('物理特技の威力を%で表示し、会心の守備力無視を明記する',async({page})=>{
 await page.goto('/');await ready(page);
 await page.evaluate(()=>{state.lv=5;allies();render();});
 // もちもの：操作中の人物（アステル）の物理特技
 await page.locator('[data-screen="bag"]').click();await page.locator('[data-tab="skills"]').click();
 const slashRow=page.locator('#inventory .item').filter({hasText:'流星斬り'});
 await expect(slashRow).toContainText('攻撃力参照の物理攻撃（威力240%）'+critText+' · MP 8');
 await expect(page.locator('#inventory')).not.toContainText(/威力[\d.]+倍/);
 await page.screenshot({path:test.info().outputPath('bag-skills.png')});
 // 仲間詳細：リナの固有特技
 await page.locator('[data-screen="party"]').click();await page.locator('[data-character="1"]').click();
 const rina=page.locator('#partyDetails .character-card');
 await expect(rina).toContainText('物理攻撃（威力160%）');await expect(rina).toContainText('物理攻撃（威力220%）');
 await expect(rina).not.toContainText('倍');
 await page.screenshot({path:test.info().outputPath('rina-skills.png')});
 // 戦闘のスキル詳細
 await page.locator('#backToParty').click();await page.locator('[data-screen="adventure"]').click();
 await page.locator('[data-action="explore"]').click();
 await page.evaluate(()=>{state.mp=36;state.enemies.forEach(e=>Object.assign(e,{hp:1000,max:1000,atk:0}));render(false);});
 await advanceToInput(page);
 await page.locator('[data-action="skills"]').click();await page.locator('[data-action="skill:slash"]').click();
 await expect(page.locator('#skillDetail p').first()).toHaveText('物理 · 攻撃力参照の物理攻撃（威力240%）'+critText);
 await page.screenshot({path:test.info().outputPath('battle-skill-detail.png')});
});

test('旧定義のdescに残る「威力X倍」と末尾の句点を重複させない',async({page})=>{
 await page.goto('/');await ready(page);
 await page.evaluate(()=>{
  // DBの旧公開版・旧battleContentと同じ文言を再現する（表示用の互換確認）
  GameData.skills.find(s=>s.id==='slash').desc='攻撃力参照・物理威力2.4倍';
  GameData.skills.find(s=>s.id==='flame').desc='賢さを炎に変える。守備力の影響なし';
  state.lv=7;allies();render();
 });
 await page.locator('[data-screen="bag"]').click();await page.locator('[data-tab="skills"]').click();
 await expect(page.locator('#inventory .item').filter({hasText:'流星斬り'})).toContainText('攻撃力参照（威力240%）'+critText);
 await expect(page.locator('#inventory .item').filter({hasText:'火花の魔法'})).toContainText('賢さを炎に変える。守備力の影響なし · MP 4');
 const text=await page.evaluate(()=>[skillDescription({...skillList.find(s=>s.id==='slash'),desc:'狙いを定めた物理攻撃。'}),skillDescription({...skillList.find(s=>s.id==='slash'),desc:''})]);
 expect(text).toEqual(['狙いを定めた物理攻撃（威力240%）'+critText,'威力240%'+critText]);
});
