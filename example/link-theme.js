#!/usr/bin/env node
'use strict';

// Point Hexo at the working tree. Build/server hooks ensure the link exists; repeated calls
// leave a correct link alone so an active watcher is not disrupted.

const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const dest = path.join(__dirname, 'themes', 'drift');
const entry = fs.lstatSync(dest, { throwIfNoEntry: false });
if (entry && entry.isSymbolicLink()) {
  let current;
  try {
    current = fs.realpathSync(dest);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  if (current === fs.realpathSync(root)) {
    console.log('link-theme: themes/drift already points to the theme source');
    process.exit(0);
  }
  fs.unlinkSync(dest);
} else if (entry) {
  // Keep a former copy (including any local edits) when migrating to the linked setup.
  const backup = dest + '.backup-' + new Date().toISOString().replace(/[:.]/g, '-');
  fs.renameSync(dest, backup);
  console.log(`link-theme: previous theme saved as ${path.relative(__dirname, backup)}`);
}

fs.mkdirSync(path.dirname(dest), { recursive: true });
// Relative directory symlinks keep macOS/Linux checkouts movable. Windows junctions do not
// require Developer Mode, but their target must be absolute; rerunning this script repairs it.
const windows = process.platform === 'win32';
const target = windows ? root : path.relative(path.dirname(dest), root);
fs.symlinkSync(target, dest, windows ? 'junction' : 'dir');
console.log(`link-theme: themes/drift -> ${target}`);
