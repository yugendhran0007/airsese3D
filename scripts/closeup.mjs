import puppeteer from 'puppeteer-core';
const outDir = process.argv[2] ?? '.';
const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome', headless: 'new',
  args: ['--no-sandbox', '--window-size=1600,900', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  defaultViewport: { width: 1600, height: 900 },
});
const page = await browser.newPage();
await page.goto('http://localhost:5183/', { waitUntil: 'load', timeout: 60000 });
await new Promise((r) => setTimeout(r, 9000));
// Walk the avatar next to a desk pod and switch to follow cam for a crowd close-up
await page.evaluate(() => {
  window.__char.position.x = -5;
  window.__char.position.z = 2.2;
  window.__char.heading = Math.PI; // face the pod at (-5,5)... look toward +? adjust
  window.__ui.getState().setCameraMode('follow');
});
await new Promise((r) => setTimeout(r, 4000));
await page.screenshot({ path: `${outDir}/closeup1.png` });
// Second angle: near zone B pod
await page.evaluate(() => {
  window.__char.position.x = 8;
  window.__char.position.z = -3.5;
  window.__char.heading = 0.6;
});
await new Promise((r) => setTimeout(r, 4000));
await page.screenshot({ path: `${outDir}/closeup2.png` });
console.log('done');
await browser.close();
