import puppeteer from 'puppeteer-core';

const outDir = process.argv[2] ?? '.';
const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome',
  headless: 'new',
  args: ['--no-sandbox', '--window-size=1600,900', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  defaultViewport: { width: 1600, height: 900 },
});
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto('http://localhost:5183/', { waitUntil: 'networkidle2', timeout: 30000 });
await new Promise((r) => setTimeout(r, 6000));

// Hero shot: default green state
await page.screenshot({ path: `${outDir}/final_hero.png` });

// Drive to red: crowded + starved ventilation, fast-forward
await page.evaluate(() => {
  window.__engine.setTotalPeople(80);
  window.__engine.setParams({ ventilation: 12, freshAir: 15, ac: 30, speed: 10 });
});
await new Promise((r) => setTimeout(r, 14000));
const red = await page.evaluate(() => ({
  co2: Math.round(window.__engine.snapshot.overall.co2),
  status: window.__engine.snapshot.overall.status,
  alerts: window.__engine.activeAlerts.length,
}));

// Open charts + human panel for the money shot
await page.evaluate(() => {
  window.__engine.setParams({ speed: 1 });
});
const btnByTitle = async (t) => (await page.$(`button[title="${t}"]`))?.click();
await btnByTitle('History charts');
await btnByTitle('Human insight (educational)');
await new Promise((r) => setTimeout(r, 2500));
await page.screenshot({ path: `${outDir}/final_red.png` });

// Thresholds panel
await btnByTitle('Human insight (educational)');
await btnByTitle('History charts');
await btnByTitle('Status thresholds');
await new Promise((r) => setTimeout(r, 1500));
await page.screenshot({ path: `${outDir}/final_thresholds.png` });

// Simulation mode switch → dummy outdoor source
const simTab = (await page.$$('button')).filter(async () => true);
for (const b of await page.$$('button')) {
  const text = await b.evaluate((el) => el.textContent);
  if (text?.trim().toUpperCase() === 'SIMULATION') {
    await b.click();
    break;
  }
}
await new Promise((r) => setTimeout(r, 2500));
const simMode = await page.evaluate(() => ({
  source: document.body.innerText.includes('SIMULATED') && document.body.innerText.includes('Dummy provider'),
  outdoorLoc: window.__engine.outdoor?.location,
}));

console.log(JSON.stringify({ red, simMode, pageErrors: errors }, null, 2));
await browser.close();
