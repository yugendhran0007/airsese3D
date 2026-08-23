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
await page.goto('http://localhost:5183/', { waitUntil: 'load', timeout: 60000 });
await new Promise((r) => setTimeout(r, 8000));

const results = {};

// Turn on Increase mode at 10× — conditions must degrade continuously
const clickByText = (needle) =>
  page.evaluate((n) => {
    const btn = [...document.querySelectorAll('button')].find((b) =>
      b.textContent?.toUpperCase().includes(n),
    );
    if (btn) btn.click();
    return !!btn;
  }, needle);
results.increaseClicked = await clickByText('INCREASE');
await page.evaluate(() => window.__engine.setParams({ speed: 10 }));
await new Promise((r) => setTimeout(r, 15000));
results.afterIncrease = await page.evaluate(() => ({
  people: window.__engine.totalPeople(),
  vent: Math.round(window.__engine.params.ventilation),
  co2: Math.round(window.__engine.snapshot.overall.co2),
  status: window.__engine.snapshot.overall.status,
}));
await page.screenshot({ path: `${outDir}/it4_increase.png` });

// Decrease mode — must recover
await clickByText('INCREASE'); // toggle off
await clickByText('DECREASE');
await new Promise((r) => setTimeout(r, 15000));
results.afterDecrease = await page.evaluate(() => ({
  people: window.__engine.totalPeople(),
  vent: Math.round(window.__engine.params.ventilation),
  co2: Math.round(window.__engine.snapshot.overall.co2),
  status: window.__engine.snapshot.overall.status,
}));
await page.screenshot({ path: `${outDir}/it4_decrease.png` });

results.pageErrors = errors.slice(0, 5);
console.log(JSON.stringify(results, null, 2));
await browser.close();
