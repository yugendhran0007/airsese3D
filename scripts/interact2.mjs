import puppeteer from 'puppeteer-core';

const url = 'http://localhost:5183/?nofx'; // effects off → higher FPS in SwiftShader
const outDir = process.argv[2] ?? '.';

const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome',
  headless: 'new',
  args: ['--no-sandbox', '--window-size=1280,720', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  defaultViewport: { width: 1280, height: 720 },
});
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
await new Promise((r) => setTimeout(r, 4000));

const results = {};

// --- WASD movement ---
results.charBefore = await page.evaluate(() => ({ ...window.__char.position }));
await page.keyboard.down('KeyW');
await new Promise((r) => setTimeout(r, 2500));
await page.keyboard.up('KeyW');
results.charAfterW = await page.evaluate(() => ({ ...window.__char.position, zone: undefined }));
results.wasdMoved =
  Math.hypot(results.charAfterW.x - results.charBefore.x, results.charAfterW.z - results.charBefore.z) > 1;
results.cameraMode = await page.evaluate(() => document.body.innerText.includes('You · Zone'));

// --- click-to-walk (programmatic target = same code path as floor raycast) ---
await page.evaluate(() => {
  window.__char.target = { x: 6, z: -6 };
  window.__char.targetSetAt = performance.now() / 1000;
});
await new Promise((r) => setTimeout(r, 8000));
results.clickWalk = await page.evaluate(() => ({
  pos: { x: +window.__char.position.x.toFixed(2), z: +window.__char.position.z.toFixed(2) },
  arrived: Math.hypot(window.__char.position.x - 6, window.__char.position.z + 6) < 2,
}));
results.hudZone = await page.evaluate(() => {
  const m = document.body.innerText.match(/You · Zone ([A-D])/i);
  return m?.[1] ?? null;
});
await page.screenshot({ path: `${outDir}/it2_walk.png` });

// --- presentation mode via dev handle ---
await page.evaluate(() => window.__scenario.startPresentation());
await new Promise((r) => setTimeout(r, 4000));
results.presentation = await page.evaluate(() => ({
  sceneVisible: /SCENE \d \/ 9/.test(document.body.innerText),
  caption: document.body.innerText.includes('A normal morning'),
}));
await page.screenshot({ path: `${outDir}/it2_present.png` });
await page.keyboard.press('Escape');
await new Promise((r) => setTimeout(r, 1500));
results.escExits = await page.evaluate(() => !/SCENE \d \/ 9/.test(document.body.innerText));

// --- scenario 4 fast-forward: red/yellow → green arc ---
await page.evaluate(() => {
  window.__scenario.playScenario('improved-ventilation');
  window.__engine.setParams({ speed: 10 });
});
await new Promise((r) => setTimeout(r, 6000));
results.midScenario = await page.evaluate(() => ({
  co2: Math.round(window.__engine.snapshot.overall.co2),
  status: window.__engine.snapshot.overall.status,
}));
await new Promise((r) => setTimeout(r, 12000));
results.endScenario = await page.evaluate(() => ({
  co2: Math.round(window.__engine.snapshot.overall.co2),
  temp: +window.__engine.snapshot.overall.temperature.toFixed(1),
  status: window.__engine.snapshot.overall.status,
}));

results.pageErrors = errors;
console.log(JSON.stringify(results, null, 2));
await browser.close();
