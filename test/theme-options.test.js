'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { cardEffect, languageOptions } = require('../lib/theme-options');
const available = ['default', 'zh-CN', 'fr'];

test('reflection presets include an off state and preserve boolean configurations', () => {
  for (const value of ['foil', 'holographic', 'polychrome', 'negative', 'glass', 'pixel-glass', 'none']) assert.equal(cardEffect(value), value);
  assert.equal(cardEffect(true), 'holographic');
  assert.equal(cardEffect(false), 'none');
  assert.equal(cardEffect(undefined), 'holographic');
  assert.equal(cardEffect('invalid'), 'holographic');
});

test('language defaults accept Hexo strings, arrays and regional aliases', () => {
  assert.deepEqual(languageOptions({}, 'zh-CN', available), { languages: ['zh-CN', 'en'], default: 'zh-CN' });
  assert.equal(languageOptions({}, ['en-US', 'zh-CN'], available).default, 'en');
  assert.equal(languageOptions({ default: 'EN' }, 'zh-CN', available).default, 'en');
});

test('custom languages are deduplicated and missing or unsafe packs are excluded', () => {
  const settings = languageOptions({ languages: ['fr', 'en', 'FR', 'missing', '"><script>'] }, 'fr', available);
  assert.deepEqual(settings, { languages: ['fr', 'en'], default: 'fr' });
  assert.deepEqual(languageOptions({ languages: [] }, 'zh-CN', available), { languages: ['en'], default: 'en' });
});

test('disabling the switcher restricts the page to the configured language', () => {
  assert.deepEqual(languageOptions({ enable: false, default: 'en' }, 'zh-CN', available), { languages: ['en'], default: 'en' });
});
