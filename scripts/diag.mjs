import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome', headless: 'new',
  args: ['--no-sandbox', '--window-size=800,500', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  defaultViewport: { width: 800, height: 500 },
});
const page = await browser.newPage();
await page.goto('http://localhost:5183/?nofx', { waitUntil: 'load', timeout: 60000 });
await new Promise((r) => setTimeout(r, 5000));
const t0 = await page.evaluate(() => { window.__engine.setParams({ speed: 10 }); return { sim: window.__engine.simTime, speed: window.__engine.params.speed }; });
await new Promise((r) => setTimeout(r, 5000));
const t1 = await page.evaluate(() => ({ sim: window.__engine.simTime, speed: window.__engine.params.speed, running: window.__engine.running }));
console.log(JSON.stringify({ t0, t1, simDelta: t1.sim - t0.sim, expected: 5 * 60 * 10 }));
await browser.close();
