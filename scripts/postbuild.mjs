// Remove start_url from the manifest. iOS "Add to Home Screen" then keeps the page URL,
// which carries the household id (/h/<id>), instead of launching at "/" with no household.
import { readFileSync, writeFileSync, mkdirSync, cpSync } from 'node:fs';
const p = new URL('../dist/manifest.webmanifest', import.meta.url);
const m = JSON.parse(readFileSync(p, 'utf8'));
delete m.start_url;
writeFileSync(p, JSON.stringify(m));
console.log('manifest: start_url removed');

// Publish artifact-format page fragments (title + style + body) as full documents.
function publishPage(srcRel, outDir) {
  const src = readFileSync(new URL(srcRel, import.meta.url), 'utf8');
  const doc = `<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<link rel="icon" href="/icon.svg" type="image/svg+xml">\n${src}`;
  const headEnd = doc.indexOf('</style>') + '</style>'.length;
  const html = doc.slice(0, headEnd) + '\n</head>\n<body>\n' + doc.slice(headEnd) + '\n</body>\n</html>\n';
  mkdirSync(new URL(`../dist/${outDir}/`, import.meta.url), { recursive: true });
  writeFileSync(new URL(`../dist/${outDir}/index.html`, import.meta.url), html);
}
publishPage('../docs/release-notes/index.html', 'notes');
cpSync(new URL('../docs/release-notes/shots/', import.meta.url), new URL('../dist/notes/shots/', import.meta.url), { recursive: true });
publishPage('../docs/guide/index.html', 'guide');
console.log('pages: published /notes/ and /guide/');
