import puppeteer from 'puppeteer-core';

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
await page.goto('http://localhost:5183/?nofx', { waitUntil: 'networkidle2', timeout: 30000 });
await new Promise((r) => setTimeout(r, 4000));

const results = {};

// Scenario 4 at 10× — must end green even when frames jump over steps
await page.evaluate(() => {
  window.__scenario.playScenario('improved-ventilation');
  window.__engine.setParams({ speed: 10 });
});
await new Promise((r) => setTimeout(r, 16000));
results.scenario4End = await page.evaluate(() => ({
  co2: Math.round(window.__engine.snapshot.overall.co2),
  temp: +window.__engine.snapshot.overall.temperature.toFixed(1),
  status: window.__engine.snapshot.overall.status,
  vent: window.__engine.params.ventilation,
  ac: window.__engine.params.ac,
  scenarioDone: !document.body.innerText.includes('Stop'),
}));

// Presentation: scene 1 caption visible shortly after start, ~90 sim-min scenes
await page.evaluate(() => window.__scenario.startPresentation());
await new Promise((r) => setTimeout(r, 5000));
results.presentScene1 = await page.evaluate(() => ({
  scene: document.body.innerText.match(/SCENE (\d) \/ 9/)?.[1],
  caption1: document.body.innerText.includes('A normal morning'),
}));
await page.screenshot({ path: `${outDir}/it3_present1.png` });
// Jump ahead: watch it reach a later scene
await new Promise((r) => setTimeout(r, 60000));
results.presentLater = await page.evaluate(() => ({
  scene: document.body.innerText.match(/SCENE (\d) \/ 9/)?.[1],
  status: window.__engine.snapshot.overall.status,
  co2: Math.round(window.__engine.snapshot.overall.co2),
}));
await page.screenshot({ path: `${outDir}/it3_present_later.png` });

results.pageErrors = errors;
console.log(JSON.stringify(results, null, 2));
await browser.close();
