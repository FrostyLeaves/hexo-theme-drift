'use strict';

const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');
const source = readFileSync(join(__dirname, '../source/js/language.js'), 'utf8');

class Element extends EventTarget {
  constructor(attrs = {}) { super(); this.attrs = attrs; }
  getAttribute(key) { return this.attrs[key]; }
  setAttribute(key, value) { this.attrs[key] = value; }
}
class CustomEvent extends Event {
  constructor(type, { detail }) { super(type); this.detail = detail; }
}

function page({ blocked = false, language = 'zh-CN' } = {}) {
  const button = new Element();
  const copy = new Element({ 'data-i18n': 'post.copy', 'data-i18n-aria-label': 'post.copy' });
  const title = new Element({ 'data-i18n-document-title': 'category.title', 'data-site-title': 'Drift' });
  const root = { lang: language };
  const document = new EventTarget();
  const events = [];
  const saved = new Map();
  Object.assign(document, {
    documentElement: root,
    getElementById: () => button,
    querySelector: () => title,
    querySelectorAll: selector => selector === '[data-i18n]' || selector === '[data-i18n-aria-label]' ? [copy] : []
  });
  document.addEventListener('drift:language', event => events.push(event.detail.language));
  const theme = {
    palettes: { blue: {}, custom: { label: 'My palette' } }, background: { styles: ['sky'] },
    i18n: { default: 'zh-CN', languages: ['zh-CN', 'en'], dictionaries: {
      'zh-CN': { 'post.copy': '复制', 'category.title': '分类', 'language.name': '中文', 'language.toggle': '切换语言', 'mode.auto': '自动' },
      en: { 'post.copy': 'Copy', 'category.title': 'Categories', 'language.name': 'English', 'language.toggle': 'Language', 'mode.auto': 'Auto' }
    } }
  };
  vm.runInNewContext(source, { document, window: { __THEME: theme }, CustomEvent, localStorage: {
    setItem(key, value) { if (blocked) throw new Error('Blocked'); saved.set(key, value); }
  } });
  return { button, root, copy, theme, document, events, saved, click: () => button.dispatchEvent(new Event('click')) };
}

test('language switching updates accessibility labels, page title and dynamic controls', () => {
  const p = page();
  assert.equal(p.copy.textContent, '复制');
  p.click();
  assert.equal(p.root.lang, 'en');
  assert.equal(p.copy.textContent, 'Copy');
  assert.equal(p.copy.getAttribute('aria-label'), 'Copy');
  assert.equal(p.document.title, 'Categories · Drift');
  assert.equal(p.theme.labels.modes.auto, 'Auto');
  assert.equal(p.theme.labels.custom, 'My palette');
  assert.equal(p.button.getAttribute('aria-label'), 'Language: English');
  assert.equal(p.saved.get('drift-language'), 'en');
  assert.deepEqual(p.events, ['zh-CN', 'en']);
});

test('invalid preferences fall back and switching works when storage is blocked', () => {
  const p = page({ language: 'unknown', blocked: true });
  assert.equal(p.root.lang, 'zh-CN');
  p.click();
  assert.equal(p.root.lang, 'en');
  p.click();
  assert.equal(p.root.lang, 'zh-CN');
});
