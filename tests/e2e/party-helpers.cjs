// Existing hero-focused regressions explicitly choose normal attacks for companions.
async function heroInput(page){
 for(let i=0;i<160;i++){
  const flags=await page.evaluate(()=>({waiting:!!battleMessageResolve,input:!!commandResolve,actor:actingAlly,battle:!!state.enemy}));
  if(flags.input){if(flags.actor===0)return;await page.locator('[data-action="attack"]').click();}
  else if(flags.waiting)await page.locator('#fieldMessage').click();
  else if(!flags.battle)return;
  else await page.waitForTimeout(10);
 }
 throw Error('hero input not reached');
}
module.exports={heroInput};
