import puppeteer from 'puppeteer-core';

const url = 'http://localhost:5183/';
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
await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
await new Promise((r) => setTimeout(r, 4000));

const results = {};

// --- Test 1: poor ventilation drives CO2 up, alerts fire ---
await page.evaluate(() => {
  const e = window.__engine;
  e.setTotalPeople(50);
  e.setParams({ ventilation: 25, freshAir: 30, speed: 10 });
});
await new Promise((r) => setTimeout(r, 12000)); // 12s × 60 × 10 = 2h sim
results.poorVent = await page.evaluate(() => {
  const e = window.__engine;
  return {
    co2: Math.round(e.snapshot.overall.co2),
    status: e.snapshot.overall.status,
    alerts: e.activeAlerts.length,
    firstAlert: e.activeAlerts[0]?.title ?? null,
    recommendation: e.activeAlerts[0]?.recommendation ?? null,
    temp: e.snapshot.overall.temperature.toFixed(1),
    o2: e.snapshot.overall.o2.toFixed(2),
    historyLen: e.history.read(999).length,
  };
});
await page.screenshot({ path: `${outDir}/it_poorvent.png` });

// --- Test 2: recovery — high ventilation pulls CO2 back down ---
await page.evaluate(() => {
  window.__engine.setParams({ ventilation: 95, freshAir: 95 });
});
await new Promise((r) => setTimeout(r, 9000));
results.recovery = await page.evaluate(() => {
  const e = window.__engine;
  return { co2: Math.round(e.snapshot.overall.co2), status: e.snapshot.overall.status, alerts: e.activeAlerts.length };
});

// --- Test 3: charts drawer ---
await page.evaluate(() => {
  window.__engine.setParams({ speed: 1 });
});
const chartBtn = await page.$('button[title="History charts"]');
await chartBtn.click();
await new Promise((r) => setTimeout(r, 1500));
await page.screenshot({ path: `${outDir}/it_charts.png` });
results.chartsOpened = true;

// --- Test 4: WASD moves the character + zone HUD updates ---
results.charBefore = await page.evaluate(() => ({ ...window.__char.position }));
await page.keyboard.down('KeyW');
await new Promise((r) => setTimeout(r, 1500));
await page.keyboard.up('KeyW');
await page.keyboard.down('KeyD');
await new Promise((r) => setTimeout(r, 1500));
await page.keyboard.up('KeyD');
results.charAfter = await page.evaluate(() => ({ ...window.__char.position }));
results.charMoved =
  Math.hypot(
    results.charAfter.x - results.charBefore.x,
    results.charAfter.z - results.charBefore.z,
  ) > 1;
await page.screenshot({ path: `${outDir}/it_character.png` });

// --- Test 5: click-to-walk ---
await page.evaluate(() => {
  window.__char.target = { x: 5, z: -5 };
  window.__char.targetSetAt = performance.now() / 1000;
});
await new Promise((r) => setTimeout(r, 4000));
results.clickWalk = await page.evaluate(() => ({
  pos: { ...window.__char.position },
  arrived: Math.hypot(window.__char.position.x - 5, window.__char.position.z + 5) < 1.5,
}));

// --- Test 6: presentation mode ---
const presentBtn = await page.$$eval('button', () => {});
const buttons = await page.$$('button');
for (const b of buttons) {
  const text = await b.evaluate((el) => el.textContent);
  if (text?.includes('Present')) {
    await b.click();
    break;
  }
}
await new Promise((r) => setTimeout(r, 5000));
await page.screenshot({ path: `${outDir}/it_present.png` });
results.presentation = await page.evaluate(() => {
  const captions = document.body.innerText.includes('SCENE');
  return { sceneCounterVisible: captions };
});
await page.keyboard.press('Escape');
await new Promise((r) => setTimeout(r, 1000));

// --- Test 7: room resize rebuilds ---
await page.evaluate(() => {
  const e = window.__engine;
  e.setParams({ room: { width: 16, length: 12, height: 3 } });
});
await new Promise((r) => setTimeout(r, 2500));
await page.screenshot({ path: `${outDir}/it_smallroom.png` });
results.smallRoom = await page.evaluate(() => window.__engine.params.room);

results.pageErrors = errors;
console.log(JSON.stringify(results, null, 2));
await browser.close();
