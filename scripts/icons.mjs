// Rasterizes public/icon.svg into the PNG sizes the manifest and iOS need.
// Run from the repo root:  npm i --no-save playwright-core && node scripts/icons.mjs
import { chromium } from 'playwright-core';
import { readFileSync } from "node:fs";
const svg = readFileSync('public/icon.svg', 'utf8');
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 600, height: 600 }, deviceScaleFactor: 1 });
for (const [name, px] of [['icon-512', 512], ['icon-192', 192], ['apple-touch-icon', 180]]) {
  await page.setContent(`<body style="margin:0;background:#000"><div id="i" style="width:${px}px;height:${px}px;line-height:0">${svg.replace('<svg ', `<svg width="${px}" height="${px}" `)}</div></body>`);
  await page.locator('#i').screenshot({ path: `public/${name}.png`, omitBackground: true });
  console.log('wrote', name, px);
}
await browser.close();
