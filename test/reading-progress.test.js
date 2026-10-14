'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { measure, arrange, activeHeading } = require('../source/js/reading-progress');

const article = { top: 300, bottom: 5000, headerHeight: 64, viewportHeight: 800, documentHeight: 9000 };
test('progress starts at the body and finishes before comments and the footer', () => {
  assert.equal(measure({ ...article, scrollY: 0 }).progress, 0);
  const { start, end } = measure({ ...article, scrollY: 0 });
  assert.equal(measure({ ...article, scrollY: (start + end) / 2 }).progress, 0.5);
  assert.equal(measure({ ...article, scrollY: 4232 }).progress, 1);
  assert.equal(measure({ ...article, scrollY: 8200 }).progress, 1);
});
test('an article fitting on screen has a finite complete state', () => {
  assert.equal(measure({ ...article, bottom: 600, scrollY: 0 }).progress, 1);
  assert.equal(measure({ ...article, top: 1000, bottom: 1200, scrollY: 0 }).progress, 0);
  assert.equal(measure({ ...article, top: 1000, bottom: 1200, scrollY: 500 }).progress, 1);
});
test('completion is reachable even when the page has no space below the article', () => {
  const state = measure({ ...article, documentHeight: 5000, scrollY: 4200 });
  assert.equal(state.end, 4200);
  assert.equal(state.progress, 1);
});
test('scroll spy retains the preceding listed heading and handles empty outlines', () => {
  assert.equal(activeHeading([400, 1000, 2000], 100, false), -1);
  assert.equal(activeHeading([400, 1000, 2000], 1500, false), 1);
  assert.equal(activeHeading([400, 1000, 2000], 1950, true), 2);
  assert.equal(activeHeading([], 1500, true), -1);
});
test('clustered labels stay ordered, inside the rail, and never overlap', () => {
  for (const positions of [[-800, -700, 5, 5, 2000], [0, 2, 3, 4, 5], [900, 901, 902, 903, 904]]) {
    const layout = arrange(positions, 300, 2);
    assert.equal(layout.overflow, false);
    assert.ok(layout.tops[0] >= 0);
    layout.tops.forEach((top, i) => {
      assert.ok(top + layout.sizes[i] <= 300);
      if (i) assert.ok(top >= layout.tops[i - 1] + layout.sizes[i - 1]);
    });
  }
});
test('long outlines use scrollable rows instead of overlapping or hiding links', () => {
  const layout = arrange(Array.from({ length: 40 }, (_, i) => i * 100), 200, 30);
  assert.equal(layout.overflow, true);
  assert.equal(layout.height, 40 * 40 + 48);
  assert.equal(layout.tops.length, 40);
  assert.equal(layout.tops[31], 31 * 40 + 48);
  assert.deepEqual(arrange([], 200, -1), { tops: [], sizes: [], overflow: false, height: 200 });
});
