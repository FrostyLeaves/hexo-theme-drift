#!/usr/bin/env node
'use strict';

/**
 * Check SVG diagrams against docs/guide.en.md#svg-contract. Run it from the site root:
 *   node themes/drift/tools/check-theme-svg.js                 # source/_posts and source/_diagrams
 *   node themes/drift/tools/check-theme-svg.js path/to/dir ... # explicit files or directories
 *   node themes/drift/tools/check-theme-svg.js --update-tokens # rewrite every token <style> block
 *                                                                 # to the current canonical one first
 * Files without data-theme-svg="1" outside source/_diagrams are reported as skipped:
 * they are not diagrams and theme_svg refuses to embed them anyway.
 */

const fs = require('node:fs');
const path = require('node:path');
const { validate, formatErrors, updateTokens } = require('../lib/theme-svg-contract');

const root = process.cwd();
const args = process.argv.slice(2);
const update = args.includes('--update-tokens');
const targets = args.filter(arg => !arg.startsWith('--'));
if (!targets.length) targets.push('source/_posts', 'source/_diagrams');

function walk(entry, out) {
  if (!fs.existsSync(entry)) return;
  const stat = fs.statSync(entry);
  if (stat.isDirectory()) {
    for (const name of fs.readdirSync(entry)) walk(path.join(entry, name), out);
  } else if (entry.toLowerCase().endsWith('.svg')) {
    out.push(entry);
  }
}

const files = [];
for (const target of targets) walk(path.resolve(root, target), files);

let checked = 0, failed = 0, skipped = 0, updated = 0;
for (const file of files) {
  const relative = path.relative(root, file).split(path.sep).join('/');
  let text = fs.readFileSync(file, 'utf8');
  const isDiagram = /\bdata-theme-svg="1"/.test(text) || relative.includes('/_diagrams/');
  if (!isDiagram) { skipped++; console.log(`skip   ${relative} (no data-theme-svg marker)`); continue; }
  if (update) {
    const result = updateTokens(text);
    if (result.changed) {
      fs.writeFileSync(file, result.svg, 'utf8');
      text = result.svg;
      updated++;
      console.log(`update ${relative} (token block replaced)`);
    }
  }
  checked++;
  const result = validate(text, { file: relative });
  if (result.ok) {
    console.log(`ok     ${relative}`);
  } else {
    failed++;
    console.log(`FAIL   ${relative}`);
    console.log(formatErrors(result, relative).split('\n').slice(1).join('\n'));
  }
}
console.log(`\n${checked} checked, ${failed} failed, ${skipped} skipped${update ? `, ${updated} updated` : ''}`);
process.exit(failed ? 1 : 0);
