const fs=require('node:fs');
const path=require('node:path');
const {spawnSync}=require('node:child_process');

const root=path.resolve(__dirname,'..');
const resultDirectory=path.join(root,'work','playwright-fixture-probe',`${Date.now()}-${process.pid}`);
const specDirectory=path.join(resultDirectory,'specs');
const port=43000+(process.pid%2000);
const baseURL=`http://127.0.0.1:${port}`;
const fixturePath=path.join(root,'tests','e2e','fixtures.cjs');
const configPath=path.join(resultDirectory,'playwright.config.cjs');
const cliPath=path.join(root,'node_modules','playwright','cli.js');
fs.mkdirSync(specDirectory,{recursive:true});
fs.writeFileSync(configPath,`const path=require('node:path');
module.exports={
 testDir:${JSON.stringify(specDirectory)},
 fullyParallel:false,
 reporter:[['list']],
 use:{browserName:'chromium',launchOptions:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{},viewport:{width:1440,height:900}},
 projects:[{name:'fixture-probe',use:{baseURL:${JSON.stringify(baseURL)}}}],
 webServer:{command:'node server/dev.mjs',cwd:${JSON.stringify(root)},env:{PORT:${JSON.stringify(String(port))},RPG_DB_PATH:path.join(${JSON.stringify(resultDirectory)},'probe.sqlite')},url:${JSON.stringify(baseURL)},reuseExistingServer:false},
};
`);

function runProbe(name,probePath){
 const result=spawnSync(process.execPath,[cliPath,'test','--config',configPath,probePath,'--project=fixture-probe','--workers=1'],{
  cwd:root,
  env:process.env,
  encoding:'utf8',
  maxBuffer:10*1024*1024,
 });
 fs.writeFileSync(path.join(resultDirectory,`${name}.stdout.log`),result.stdout||'');
 fs.writeFileSync(path.join(resultDirectory,`${name}.stderr.log`),result.stderr||'');
 return result;
}

function assertResult(name,result,condition,message){
 if(result.error)throw new Error(`${name} probe could not start: ${result.error.message}`);
 if(!condition)throw new Error(`${message}\n${result.stdout||''}\n${result.stderr||''}`);
}

const expectedAbortPath=path.join(specDirectory,'known-external-font.spec.cjs');
fs.writeFileSync(expectedAbortPath,`const {test,expect}=require(${JSON.stringify(fixturePath)});
test('known external font abort stays isolated from the local app',async({page})=>{
 await page.goto('/');
 await expect(page.locator('html')).toHaveAttribute('data-game-ready','true');
});
`);
const expectedAbort=runProbe('expected-font-abort',expectedAbortPath);
assertResult('expected font abort',expectedAbort,expectedAbort.status===0,'Expected the known, deliberately aborted Google Fonts request to pass.');

const unknownErrorsPath=path.join(specDirectory,'unknown-browser-errors.spec.cjs');
fs.writeFileSync(unknownErrorsPath,`const {test}=require(${JSON.stringify(fixturePath)});
test('unknown console and page errors fail diagnostics',async({page})=>{
 await page.goto('/');
 await page.evaluate(()=>{
  console.error('qa-fixture-console-probe: Failed to load resource: net::ERR_FAILED');
  setTimeout(()=>{throw new Error('qa-fixture-pageerror-probe');},0);
 });
 await page.waitForTimeout(40);
});
`);
const unknownErrors=runProbe('unknown-errors',unknownErrorsPath);
const output=`${unknownErrors.stdout||''}\n${unknownErrors.stderr||''}`;
assertResult('unknown browser errors',unknownErrors,
 unknownErrors.status!==0&&unknownErrors.signal===null&&output.includes('qa-fixture-console-probe')&&output.includes('qa-fixture-pageerror-probe'),
 'Expected an unknown console ERR_FAILED and pageerror to make the child Playwright run fail.');

console.log(`E2E diagnostics probes passed. Evidence: ${path.relative(root,resultDirectory)}`);
