// URLs that must resolve, checked against the generated files.
//
// Two things no build pass covers, both of which send visitors to a 404 while
// the build prints SUCCESS:
//
//   1. `/` is a runtime <Redirect> to `customFields.docsHome`. Broken-link
//      checking reads markdown, the redirect plugin validates its own table,
//      neither reads this.
//
//   2. The paths search engines already hold — scripts/indexed-paths.txt.
//      Changing which version sits at the root swaps the content behind those
//      URLs, which is intended, but a page renamed between versions stops
//      existing unless a redirect carries it.

import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const site = dirname(dirname(fileURLToPath(import.meta.url)));
const build = join(site, 'build');

// trailingSlash: false — a route renders as PATH.html, and `/` as index.html.
// The redirect plugin emits real files too, so a redirected path counts: either
// way the visitor is not sent to a 404.
const resolves = (path) => {
  const clean = path.replace(/^\//, '').replace(/\/$/, '');
  return clean === ''
    ? existsSync(join(build, 'index.html'))
    : existsSync(join(build, clean + '.html')) ||
      existsSync(join(build, clean, 'index.html'));
};

let failed = false;

// 1. The front door. Read from the config Docusaurus resolved, not the source
// file, so this never becomes a second copy of the rule.
const resolved = join(site, '.docusaurus', 'docusaurus.config.mjs');
if (!existsSync(resolved)) {
  console.error('\n  ✗ No resolved config found. Run this after `docusaurus build`.');
  process.exit(1);
}
const home = (await import(pathToFileURL(resolved).href)).default?.customFields?.docsHome;

if (typeof home !== 'string') {
  console.error('\n  ✗ customFields.docsHome is missing from docusaurus.config.ts.');
  console.error('    src/pages/index.tsx reads it to know where `/` goes.');
  failed = true;
} else if (!resolves(home)) {
  console.error(`\n  ✗ The site root redirects to ${home}, which the build did not produce.`);
  console.error('    Every visitor landing on / would get a 404.');
  console.error('    docsHome must name a page of the version served at the root');
  console.error('    (`lastVersion` in docusaurus.config.ts).');
  failed = true;
} else {
  console.log(`  ✓ site root redirects to ${home}, which exists`);
}

// 2. The URLs already out there.
const listed = readFileSync(join(site, 'scripts', 'indexed-paths.txt'), 'utf8')
  .split('\n')
  .map((l) => l.trim())
  .filter((l) => l.startsWith('/'));

const gone = listed.filter((p) => !resolves(p));

if (gone.length) {
  console.error(`\n  ✗ ${gone.length} indexed URL(s) no longer resolve:`);
  gone.forEach((p) => console.error(`      ${p}`));
  console.error('    Anyone reaching these from a search result gets a 404.');
  console.error('    Add a redirect in docusaurus.config.ts (plugin-client-redirects),');
  console.error('    or drop the line from scripts/indexed-paths.txt if losing the');
  console.error('    URL is a decision you are making on purpose.');
  failed = true;
} else {
  console.log(`  ✓ all ${listed.length} indexed URLs still resolve`);
}

process.exit(failed ? 1 : 0);
