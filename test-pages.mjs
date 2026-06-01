import { chromium } from 'playwright';

const BASE = 'http://localhost:3002';
const pages = [
  { path: '/', name: 'Dashboard' },
  { path: '/settings', name: 'Settings' },
  { path: '/missing-locally', name: 'Missing Locally' },
  { path: '/missing-on-spotify', name: 'Missing on Spotify' },
  { path: '/metadata', name: 'Metadata' },
  { path: '/duplicates', name: 'Duplicates' },
  { path: '/backup', name: 'Backup' },
];

const browser = await chromium.launch();
const context = await browser.newContext();
const errors = [];

for (const page of pages) {
  const tab = await context.newPage();
  const jsErrors = [];
  tab.on('pageerror', (err) => jsErrors.push(err.message));
  tab.on('console', (msg) => { if (msg.type() === 'error') jsErrors.push(msg.text()); });

  try {
    const response = await tab.goto(`${BASE}${page.path}`, { waitUntil: 'networkidle', timeout: 15000 });
    const status = response?.status();

    if (status !== 200) {
      errors.push(`${page.name}: HTTP ${status}`);
      console.log(`FAIL ${page.name} (${page.path}): HTTP ${status}`);
    } else if (jsErrors.length > 0) {
      const relevant = jsErrors.filter(e => !e.includes('favicon'));
      if (relevant.length > 0) {
        errors.push(`${page.name}: JS errors - ${relevant.join('; ')}`);
        console.log(`WARN ${page.name} (${page.path}): ${relevant.length} JS error(s)`);
        relevant.forEach(e => console.log(`  -> ${e.substring(0, 200)}`));
      } else {
        console.log(`PASS ${page.name} (${page.path})`);
      }
    } else {
      console.log(`PASS ${page.name} (${page.path})`);
    }

    await tab.screenshot({ path: `test-screenshots/${page.name.toLowerCase().replace(/\s+/g, '-')}.png` });
  } catch (err) {
    errors.push(`${page.name}: ${err.message}`);
    console.log(`FAIL ${page.name} (${page.path}): ${err.message}`);
  }
  await tab.close();
}

await browser.close();

if (errors.length > 0) {
  console.log(`\n${errors.length} issue(s) found:`);
  errors.forEach(e => console.log(`  - ${e}`));
  process.exit(1);
} else {
  console.log(`\nAll ${pages.length} pages passed!`);
}
