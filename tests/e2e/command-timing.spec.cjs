const {test,expect}=require('./fixtures.cjs');
async function seed(page,{fallen=false,lethal=false,weak=false}={}){
 await page.addInitScript(()=>{Math.random=()=>0;});
 await page.goto('/');await expect(page.locator('html')).toHaveAttribute('data-game-ready','true');
 await page.locator('[data-action="explore"]').click();
 await page.evaluate(({fallen,lethal,weak})=>{
  const s=JSON.parse(localStorage.getItem('starlight-rpg-v1'));
  s.hp=fallen?0:80;s.mp=10;s.lv=3;s.companions.forEach(c=>{c.hp=80;c.mp=20;});
  s.enemies.forEach((e,i)=>Object.assign(e,{name:'敵'+i,hp:weak?1:1000,max:weak?1:1000,atk:lethal?10000:20,def:0,speed:[30,11,9,1][i]}));s.enemy=s.enemies[0];
  localStorage.setItem('starlight-rpg-v1',JSON.stringify(s));
 },{fallen,lethal,weak});
 await page.reload();await expect(page.locator('html')).toHaveAttribute('data-game-ready','true');
}
async function toInput(page){
 for(let i=0;i<100;i++){
  const f=await page.evaluate(()=>({input:!!commandResolve,message:!!battleMessageResolve,enemy:!!state.enemy}));
  if(f.input||!f.enemy)return;
  if(f.message)await page.locator('#fieldMessage').click();else await page.waitForTimeout(10);
 }
 throw Error('input not reached');
}
test('全員の番で入力を待ち、仲間のスキル・回復・道具・防御を個別に反映する',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await seed(page);await toInput(page);
 await expect(page.locator('#commandTitle')).toContainText('リナの番');
 await expect(page.locator('.party-member.acting')).toContainText('リナ');
 const saved=await page.evaluate(()=>localStorage.getItem('starlight-rpg-v1'));
 const before=await page.evaluate(()=>[state.companions[0].mp,state.mp,state.enemies[2].hp]);
 await page.locator('[data-action="skills"]').click();
 await expect(page.locator('.skill-list button')).toHaveCount(1);await expect(page.locator('[data-action="skill:rina_aimed_shot"]')).toBeVisible();
 expect(await page.evaluate(()=>useSkill('flame'))).toBe(false,'Rina cannot invoke Astel\'s skill directly');
 await page.locator('[data-action="skill:rina_aimed_shot"]').click();
 await page.keyboard.press('Escape');expect(await page.evaluate(()=>state.companions[0].mp)).toBe(before[0]);
 await page.locator('[data-action="skills"]').click();await page.locator('[data-action="skill:rina_aimed_shot"]').click();await page.locator('[data-target="2"]').click();
 await expect(page.locator('#latestLog')).toHaveText('リナのねらい撃ち！');
 expect(await page.evaluate(()=>[state.companions[0].mp,state.mp,state.enemies[2].hp])).toEqual(before);
 expect(await page.evaluate(()=>combat('attack'))).toBe(false);
 await page.locator('#fieldMessage').click();
 expect(await page.evaluate(()=>state.companions[0].mp)).toBe(before[0]-3);expect(await page.evaluate(()=>state.mp)).toBe(before[1]);
 expect(await page.evaluate(()=>state.enemies[2].hp)).toBeLessThan(before[2]);
 await toInput(page);await expect(page.locator('#commandTitle')).toContainText('ノエルの番');
 await page.evaluate(()=>{state.companions[0].hp=1;render(false);});
 await page.locator('[data-action="skills"]').click();await expect(page.locator('.skill-list button')).toHaveCount(1);await page.locator('[data-action="skill:noel_prayer_light"]').click();await page.locator('[data-ally-target="1"]').click();
 await page.locator('#fieldMessage').click();expect(await page.evaluate(()=>state.companions[0].hp)).toBe(60);expect(await page.evaluate(()=>state.companions[2].mp)).toBe(16);
 await toInput(page);await expect(page.locator('#commandTitle')).toContainText('アステルの番');
 await page.locator('[data-action="guard"]').click();await page.locator('#fieldMessage').click();
 expect(await page.evaluate(()=>state.mp)).toBe(13);
 await toInput(page);await expect(page.locator('#commandTitle')).toContainText('ガルドの番');
 await page.evaluate(()=>{state.companions[0].hp=1;render(false);});
 const herbs=await page.evaluate(()=>state.items.herb);
 await page.locator('[data-action="items"]').click();await page.locator('[data-action="use:herb"]:visible').click();await page.locator('[data-ally-target="1"]').click();
 expect(await page.evaluate(()=>state.items.herb)).toBe(herbs);await page.locator('#fieldMessage').click();
 expect(await page.evaluate(()=>state.items.herb)).toBe(herbs-1);expect(await page.evaluate(()=>state.companions[0].hp)).toBe(46);
 await toInput(page);await expect(page.locator('#commandTitle')).toContainText('リナの番');
 await expect(page.locator('#skillMenu')).toBeHidden();
 expect(await page.evaluate(()=>state.turn)).toBe(2);
 expect(await page.evaluate(()=>localStorage.getItem('starlight-rpg-v1'))).not.toBe(saved);
 await page.screenshot({path:test.info().outputPath('all-ally-commands.png')});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&document.documentElement.scrollHeight<=innerHeight)).toBe(true);
 expect(errors).toEqual([]);
});
test('主人公が戦闘不能でも仲間を操作して勝利できる',async({page})=>{
 await seed(page,{fallen:true,weak:true});await toInput(page);
 await expect(page.locator('#commandTitle')).toContainText('リナの番');
 for(let i=0;i<100;i++){
  const flags=await page.evaluate(()=>({input:!!commandResolve,message:!!battleMessageResolve,done:!busy&&!roundActive&&!state.enemy,actor:actingAlly}));
  if(flags.done)break;
  if(flags.input){expect(flags.actor).not.toBe(0);await page.locator('[data-action="attack"]').click();}
  else if(flags.message)await page.locator('#fieldMessage').click();
 }
 expect(await page.evaluate(()=>state.enemy)).toBeNull();expect(await page.evaluate(()=>state.total)).toBe(4);
});
test('主人公が先に倒れても仲間で入力を続け、全滅時は各自の上限へ回復する',async({page})=>{
 await seed(page,{lethal:true});await toInput(page);
 await expect(page.locator('#partyStatus')).toContainText('戦闘不能');await expect(page.locator('#commandTitle')).toContainText('リナの番');
 for(let i=0;i<180;i++){
  const flags=await page.evaluate(()=>({input:!!commandResolve,message:!!battleMessageResolve,done:!busy&&!roundActive&&!state.enemy,actor:actingAlly}));
  if(flags.done)break;
  if(flags.input){expect(flags.actor).not.toBe(0);await page.locator('[data-action="attack"]').click();}
  else if(flags.message)await page.locator('#fieldMessage').click();
 }
 await expect(page.locator('[data-action="rest"]')).toBeVisible();
 expect(await page.evaluate(()=>allies().map((a,i)=>[a.hp,allyStats(i).maxHP]))).toEqual([[114,114],[92,92],[140,140],[96,96]]);
});
test('もちものの人物を切り替え個別装備・能力・セーブを維持する',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await expect(page.locator('html')).toHaveAttribute('data-game-ready','true');
 await page.evaluate(()=>{state.owned.push('iron','leather');render();});
 await page.locator('[data-screen="bag"]').click();await page.locator('#inventoryCharacter').selectOption('1');
 await page.locator('[data-action="equip:iron"]').click();await page.locator('[data-action="equip:leather"]').click();
 await page.locator('#inventoryCharacter').scrollIntoViewIfNeeded();
 await expect(page.locator('#inventoryCharacter')).toHaveCSS('color','rgb(36, 61, 63)');
 await page.screenshot({path:test.info().outputPath('inventory-member-selector.png')});
 expect(await page.evaluate(()=>[state.weapon,state.armor,state.companions[0].weapon,state.companions[0].armor])).toEqual(['twig','cloth','iron','leather']);
 await page.locator('[data-screen="party"]').click();await page.locator('[data-character="1"]').click();
 await expect(page.locator('#partyDetails')).toContainText('コマンド操作');await expect(page.locator('#partyDetails')).toContainText('鉄のつるぎ');
 await page.screenshot({path:test.info().outputPath('individual-stats-equipment.png')});
 await page.reload();await expect(page.locator('html')).toHaveAttribute('data-game-ready','true');
 expect(await page.evaluate(()=>[state.companions[0].weapon,state.companions[0].armor])).toEqual(['iron','leather']);
 expect(await page.evaluate(()=>allies().map((a,i)=>allyStats(i).maxHP))).toEqual([80,64,100,68]);
 await page.locator('[data-action="explore"]').click();await toInput(page);
 await page.locator('[data-screen="bag"]').click();await expect(page.locator('#inventoryCharacter')).toBeDisabled();
 expect(errors).toEqual([]);
});
