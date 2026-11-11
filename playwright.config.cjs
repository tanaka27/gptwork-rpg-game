const fs=require('node:fs');
const path=require('node:path');
const {defineConfig}=require('@playwright/test');

const runId=`${process.pid}-${Date.now()}`;
const runDirectory=path.join(__dirname,'work','playwright',runId);
fs.mkdirSync(runDirectory,{recursive:true});

const servers=[
 {name:'game-desktop',port:4173,viewport:{width:1440,height:900}},
 {name:'game-mobile',port:4174,viewport:{width:390,height:844}},
 {name:'admin-desktop',port:4175,viewport:{width:1440,height:900}},
 {name:'admin-mobile',port:4176,viewport:{width:390,height:844}},
];
const backendSpec='**/backend.spec.cjs';

function project(server,{admin=false}={}){
 return {
  name:server.name,
  testMatch:admin?backendSpec:undefined,
  testIgnore:admin?undefined:backendSpec,
  use:{baseURL:`http://127.0.0.1:${server.port}`,viewport:server.viewport},
 };
}

module.exports=defineConfig({
 testDir:'./tests/e2e',
 fullyParallel:true,
 forbidOnly:!!process.env.CI,
 retries:0,
 reporter:[['list'],['html',{open:'never'}]],
 use:{
  browserName:'chromium',
  screenshot:'on',
  trace:'retain-on-failure',
  launchOptions:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
   ?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}
   :{},
 },
 projects:[
  project(servers[0]),
  project(servers[1]),
  project(servers[2],{admin:true}),
  project(servers[3],{admin:true}),
 ],
 webServer:servers.map(server=>({
  command:'node server/dev.mjs',
  env:{PORT:String(server.port),RPG_DB_PATH:path.join(runDirectory,`${server.name}.sqlite`)},
  url:`http://127.0.0.1:${server.port}`,
  reuseExistingServer:false,
 })),
});
