// usage: node scripts/_shot.mjs out.png '{"cam":[x,y,z]}' | '{"mode":"follow","tele":[x,z,heading]}' | '{"render":"stylized"}'
import puppeteer from 'puppeteer-core';
const [,, out, optJson='{}'] = process.argv; const opt=JSON.parse(optJson);
const browser = await puppeteer.launch({ executablePath:'/usr/bin/google-chrome', headless:'new',
  args:['--no-sandbox','--window-size=1600,900','--use-angle=swiftshader','--enable-unsafe-swiftshader'], defaultViewport:{width:1600,height:900}});
const page = await browser.newPage();
const errs=[]; page.on('pageerror',e=>errs.push(e.message)); page.on('console',m=>{ if(m.type()==='error') errs.push(m.text().slice(0,160)); });
await page.goto('http://localhost:5173/?nofx',{waitUntil:'load',timeout:60000});
await page.waitForFunction(()=>window.__ui && window.__scene && window.__camera && window.__char,{timeout:150000});
if (opt.render) await page.evaluate((r)=>window.__ui.getState().setRenderMode(r), opt.render);
await new Promise(r=>setTimeout(r,20000));
await page.evaluate((o)=>{ const u=window.__ui.getState(); if(o.cam) window.__camera.position.set(...o.cam); if(o.tele){ const c=window.__char; c.position.x=o.tele[0]; c.position.z=o.tele[1]; c.heading=o.tele[2]; c.target=null; } if(o.mode) u.setCameraMode(o.mode); }, opt);
await new Promise(r=>setTimeout(r,8000));
await page.screenshot({path: out});
console.log('errors', JSON.stringify(errs.slice(0,4)));
await browser.close();
