// Captures phone-sized screenshots of the live app into ./shots using the demo household.
// Run from this folder:  npm i --no-save playwright-core && node shoot.mjs
// Old builds (v1-*, sep13-*) were captured once from git worktrees and are kept as history; the
// script only re-captures the current app unless OLD=1 and the old builds are served on 4174/4175.
import { chromium } from 'playwright-core';
const HID = 'demo-release-notes-Xk29Qp7Lm3RtVw';
const LIVE = process.env.LIVE || 'https://bebe.fyi'; // LIVE=http://localhost:5173 to shoot a local build
const browser = await chromium.launch({ channel: 'chrome' });

const ONLY = process.env.SHOTS ? process.env.SHOTS.split(',') : null;
async function shoot(origin, path, name, steps = []) {
  if (ONLY && !ONLY.includes(name)) return;
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    colorScheme: 'dark', timezoneId: 'America/New_York', serviceWorkers: 'block',
  });
  await ctx.addInitScript(({ hid }) => { localStorage.setItem('bebe.hid', hid); localStorage.setItem('bebe.who', 'dad'); }, { hid: HID });
  const page = await ctx.newPage();
  await page.goto(origin + path, { waitUntil: 'load' });
  await page.waitForFunction(() => document.body.innerText.includes('feeds') && !document.body.innerText.includes("Who's using"), null, { timeout: 20000 });
  await page.waitForTimeout(2500); // let Firestore data land
  for (const s of steps) await s(page);
  await page.waitForTimeout(400);
  await page.screenshot({ path: `shots/${name}.png` });
  console.log('shot', name);
  await ctx.close();
}
const tap = (sel) => async (p) => { await p.locator(sel).first().click(); await p.waitForTimeout(500); };
const swipeFirstRow = async (p) => {
  await p.evaluate(async () => {
    const row = document.querySelector('.swipe .entry'); const r = row.getBoundingClientRect();
    const mk = (type, x) => { const t = new Touch({ identifier: 1, target: row, clientX: x, clientY: r.top + r.height / 2 }); return new TouchEvent(type, { touches: type === 'touchend' ? [] : [t], changedTouches: [t], bubbles: true, cancelable: true }); };
    row.dispatchEvent(mk('touchstart', r.right - 20));
    for (let x = r.right - 30; x > r.right - 150; x -= 10) { row.dispatchEvent(mk('touchmove', x)); await new Promise(res => setTimeout(res, 16)); }
    row.dispatchEvent(mk('touchend', r.right - 150));
  });
  await p.waitForTimeout(400);
};


// Welcome screen: a phone with no household yet
async function shootWelcome(name) {
  if (ONLY && !ONLY.includes(name)) return;
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    colorScheme: 'dark', timezoneId: 'America/New_York', serviceWorkers: 'block',
  });
  const page = await ctx.newPage();
  await page.goto(LIVE + '/', { waitUntil: 'load' });
  await page.waitForFunction(() => document.body.innerText.includes('Start your household'), null, { timeout: 20000 });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(600);
  await page.screenshot({ path: `shots/${name}.png` });
  console.log('shot', name);
  await ctx.close();
}

// Current build
await shootWelcome('welcome');
// The in-memory demo (no household needed)
if (!ONLY || ONLY.includes('demo-today')) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: 'dark', timezoneId: 'America/New_York', serviceWorkers: 'block' });
  const page = await ctx.newPage();
  await page.goto(LIVE + '/demo', { waitUntil: 'load' });
  await page.waitForFunction(() => document.body.innerText.includes('feeds'), null, { timeout: 20000 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'shots/demo-today.png' });
  console.log('shot demo-today');
  await ctx.close();
}
await shoot(LIVE, `/h/${HID}`, 'today');
await shoot(LIVE, `/h/${HID}`, 'sheet-feed', [tap('.dock button:nth-child(1)')]);
await shoot(LIVE, `/h/${HID}`, 'sheet-diaper', [tap('.dock button:nth-child(2)'), tap('.sheet button:has-text("Dirty")')]);
await shoot(LIVE, `/h/${HID}`, 'sheet-meds', [tap('.dock button:nth-child(4)')]);
await shoot(LIVE, `/h/${HID}`, 'summary', [tap('.tabbar button:has-text("Summary")')]);
await shoot(LIVE, `/h/${HID}`, 'summary-entries', [tap('.tabbar button:has-text("Summary")'), tap('.seg button:has-text("All entries")'), swipeFirstRow]);
await shoot(LIVE, `/h/${HID}`, 'weight', [tap('.tabbar button:has-text("Weight")')]);
await shoot(LIVE, `/h/${HID}`, 'appointments', [tap('.tabbar button:has-text("Appts")')]);
await shoot(LIVE, `/h/${HID}`, 'settings', [tap('.tabbar button:has-text("Settings")'), async (p) => { await p.evaluate(() => window.scrollTo(0, 560)); }]);
// Today in "Last time only" mode (demo household only); the settings-today shot below always switches it back.
const setMode = (label) => [tap('.tabbar button:has-text("Settings")'), tap(`.seg button:has-text("${label}")`), async (p) => { await p.waitForTimeout(800); }, tap('.tabbar button:has-text("Today")')];
await shoot(LIVE, `/h/${HID}`, 'today-last', setMode('Last time only'));
await shoot(LIVE, `/h/${HID}`, 'settings-today', [...setMode('Countdown to next'), tap('.tabbar button:has-text("Settings")'), async (p) => { const y = await p.evaluate(() => [...document.querySelectorAll('h3')].find((h) => h.textContent === 'Today screen').getBoundingClientRect().top + window.scrollY - 12); await p.evaluate((y) => window.scrollTo(0, y), y); }]);
// Meds tracking off: flip the switch, shoot Today and the card, flip it back (demo household only)
const medsSwitch = (label) => [tap('.tabbar button:has-text("Settings")'), tap(`.card:has(h3:text-is("Meds")) .seg button:has-text("${label}")`), async (p) => { await p.waitForTimeout(800); }];
await shoot(LIVE, `/h/${HID}`, 'settings-meds', [...medsSwitch('Off'), async (p) => { const y = await p.evaluate(() => [...document.querySelectorAll('h3')].find((h) => h.textContent === 'Meds').getBoundingClientRect().top + window.scrollY - 12); await p.evaluate((y) => window.scrollTo(0, y), y); }]);
await shoot(LIVE, `/h/${HID}`, 'today-meds-off', [tap('.tabbar button:has-text("Today")')]);
await shoot(LIVE, `/h/${HID}`, 'meds-back-on', [...medsSwitch('Tracking meds'), tap('.tabbar button:has-text("Today")')]);
// Diaper tracking off (demo household only): shoot, then switch it back on
const diaperSwitch = (label) => [tap('.tabbar button:has-text("Settings")'), tap(`.card:has(h3:text-is("Diapers")) .seg button:has-text("${label}")`), async (p) => { await p.waitForTimeout(800); }];
await shoot(LIVE, `/h/${HID}`, 'settings-diapers', [...diaperSwitch('Off'), async (p) => { const y = await p.evaluate(() => [...document.querySelectorAll('h3')].find((h) => h.textContent === 'Meds').getBoundingClientRect().top + window.scrollY - 12); await p.evaluate((y) => window.scrollTo(0, y), y); }]);
await shoot(LIVE, `/h/${HID}`, 'today-diapers-off', [tap('.tabbar button:has-text("Today")')]);
await shoot(LIVE, `/h/${HID}`, 'diapers-back-on', [...diaperSwitch('Tracking diapers'), tap('.tabbar button:has-text("Today")')]);
// Night feed schedule (demo household only): switch it on, shoot Settings and Today, switch it back off
const nightSwitch = (label) => [tap('.tabbar button:has-text("Settings")'), tap(`.card:has(h3:text-is("Feed timer")) .seg button:has-text("${label}")`), async (p) => { await p.waitForTimeout(800); }];
await shoot(LIVE, `/h/${HID}`, 'settings-feed-timer', [...nightSwitch('Different at night'), async (p) => { const y = await p.evaluate(() => [...document.querySelectorAll('h3')].find((h) => h.textContent === 'Feed timer').getBoundingClientRect().top + window.scrollY - 12); await p.evaluate((y) => window.scrollTo(0, y), y); }]);
await shoot(LIVE, `/h/${HID}`, 'today-night', [tap('.tabbar button:has-text("Today")')]);
await shoot(LIVE, `/h/${HID}`, 'night-back-off', [...nightSwitch('Same all day'), tap('.tabbar button:has-text("Today")')]);
// Marked Awake: from the in-memory demo, so nothing is saved
if (!ONLY || ONLY.includes('marked-awake')) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: 'dark', timezoneId: 'America/New_York', serviceWorkers: 'block' });
  const page = await ctx.newPage();
  await page.goto(LIVE + '/demo', { waitUntil: 'load' });
  await page.waitForFunction(() => document.body.innerText.includes('feeds'), null, { timeout: 20000 });
  await page.locator('.dock button:has-text("Sleep")').click(); await page.waitForTimeout(300);
  await page.locator('.sheet .chip:has-text("Bassinet")').click();
  await page.locator('.sheet button:has-text("Start sleep")').click(); await page.waitForTimeout(400);
  await page.evaluate(() => localStorage.setItem('bebe.awakeLine', '-1'));
  await page.evaluate(() => { Math.random = () => 0.15; });
  await page.locator('.dock button:has-text("Woke up")').click(); await page.waitForTimeout(700);
  await page.screenshot({ path: 'shots/marked-awake.png' });
  console.log('shot marked-awake');
  await ctx.close();
}
// Sleep: the sheet (not saved) and the Summary table scrolled to the sleep columns
await shoot(LIVE, `/h/${HID}`, 'sheet-sleep', [tap('.dock button:has-text("Sleep")')]);
await shoot(LIVE, `/h/${HID}`, 'summary-sleep', [tap('.tabbar button:has-text("Summary")'), async (p) => { await p.evaluate(() => { const w = document.querySelector('.table-wrap'); const th = [...w.querySelectorAll('th')].find((t) => t.textContent === 'Sleep'); w.scrollLeft = th.offsetLeft - w.querySelector('th').offsetWidth - 4; }); }]);
// Sleep diary: Summary → Sleep, top and bottom
await shoot(LIVE, `/h/${HID}`, 'summary-diary', [tap('.tabbar button:has-text("Summary")'), tap('.seg button:has-text("Sleep")')]);
await shoot(LIVE, `/h/${HID}`, 'summary-diary-compare', [tap('.tabbar button:has-text("Summary")'), tap('.seg button:has-text("Sleep")'), async (p) => { await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight)); }]);
if (process.env.OLD) {
  await shoot('http://localhost:4174', `/#h=${HID}`, 'v1-today');
  await shoot('http://localhost:4174', `/#h=${HID}`, 'v1-history', [tap('.tabbar button:has-text("History")')]);
  await shoot('http://localhost:4175', `/#h=${HID}`, 'sep13-today');
}
await browser.close();
