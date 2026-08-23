import puppeteer from 'puppeteer-core';

const url = process.argv[2] ?? 'http://localhost:5183/';
const shot = process.argv[3] ?? 'verify.png';
const waitMs = Number(process.argv[4] ?? 9000);

const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome',
  headless: 'new',
  args: ['--no-sandbox', '--window-size=1600,900', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  defaultViewport: { width: 1600, height: 900 },
});
const page = await browser.newPage();
const logs = [];
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push(`[PAGEERROR] ${e.message}`));

await page.goto(url, { waitUntil: 'load', timeout: 60000 });
await new Promise((r) => setTimeout(r, waitMs));

const info = await page.evaluate(() => {
  const canvas = document.querySelector('canvas');
  let pixelSample = null;
  if (canvas) {
    // Read a strip of pixels from the center of the WebGL canvas via 2D copy
    const c2 = document.createElement('canvas');
    c2.width = 8;
    c2.height = 8;
    const ctx = c2.getContext('2d');
    ctx.drawImage(canvas, canvas.width / 2 - 4, canvas.height / 2 - 4, 8, 8, 0, 0, 8, 8);
    const d = ctx.getImageData(0, 0, 8, 8).data;
    let sum = 0;
    for (let i = 0; i < d.length; i += 4) sum += d[i] + d[i + 1] + d[i + 2];
    pixelSample = sum / (d.length / 4);
  }
  const eng = window.__engine;
  return {
    hasCanvas: !!canvas,
    canvasSize: canvas ? [canvas.width, canvas.height] : null,
    centerBrightness: pixelSample,
    simTime: eng?.simTime,
    running: eng?.running,
    co2: eng?.snapshot?.overall?.co2,
    temp: eng?.snapshot?.overall?.temperature,
    people: eng?.snapshot?.overall?.people,
    status: eng?.snapshot?.overall?.status,
    outdoor: eng?.outdoor ? { t: eng.outdoor.temperature, aqi: eng.outdoor.aqi, loc: eng.outdoor.location } : null,
  };
});
console.log(JSON.stringify(info, null, 2));
console.log('--- console logs ---');
console.log(logs.slice(0, 30).join('\n') || '(none)');

await page.screenshot({ path: shot });
await browser.close();
