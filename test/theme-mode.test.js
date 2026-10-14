'use strict';

const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');

const source = readFileSync(join(__dirname, '../source/js/theme.js'), 'utf8');

class CustomEvent extends Event {
  constructor(type, { detail }) { super(type); this.detail = detail; }
}

class Element extends EventTarget {
  constructor(attrs = {}) { super(); this.attrs = { ...attrs }; }
  setAttribute(name, value) { this.attrs[name] = value; }
  getAttribute(name) { return this.attrs[name] ?? null; }
}

function page({ dark = false, mode = 'auto', stored, blocked = false, media = 'modern', comments = false } = {}) {
  const root = new Element();
  const button = new Element();
  const label = new Element();
  const meta = new Element();
  const box = new Element({ 'data-repo': 'owner/comments' });
  const storage = new Map(stored ? [['drift-mode', stored]] : []);
  const scheme = new EventTarget();
  scheme.matches = dark;
  if (media === 'legacy') {
    scheme.addListener = handler => EventTarget.prototype.addEventListener.call(scheme, 'change', handler);
    scheme.addEventListener = undefined;
  }
  const document = new EventTarget();
  const window = new EventTarget();
  const events = [];
  const messages = [];
  let frame = null;
  let script = null;
  box.appendChild = child => { script = child; };
  box.querySelector = () => frame;
  document.documentElement = root;
  document.readyState = 'complete';
  document.body = { classList: { contains: () => false } };
  document.getElementById = id => ({ 'mode-toggle': button, 'mode-label': label, comments: comments ? box : null }[id] || null);
  document.querySelector = selector => selector === 'meta[name="theme-color"]' ? meta : selector === '.utterances-frame' ? frame : null;
  document.querySelectorAll = () => [];
  document.createElement = () => new Element();
  document.addEventListener('drift:mode', event => events.push(event.detail));
  window.__THEME = { background: { mode }, labels: { modes: { auto: 'Auto', day: 'Day', night: 'Night' } } };
  if (media !== 'none') window.matchMedia = query => query === '(prefers-color-scheme: dark)' ? scheme : { matches: false };
  const context = vm.createContext({
    document, window, CustomEvent,
    localStorage: {
      getItem(key) { if (blocked) throw new Error('Storage blocked'); return storage.get(key) ?? null; },
      setItem(key, value) { if (blocked) throw new Error('Storage blocked'); storage.set(key, value); }
    }
  });
  vm.runInContext(source, context);
  return {
    root, button, label, meta, storage, events, messages,
    get script() { return script; },
    click() { button.dispatchEvent(new Event('click')); },
    system(dark) { scheme.matches = dark; scheme.dispatchEvent(new Event('change')); },
    attachFrame() { frame = { contentWindow: { postMessage: (data, origin) => messages.push({ ...data, origin }) } }; },
    resize(origin = 'https://utteranc.es', ownFrame = true) {
      const event = new Event('message');
      Object.assign(event, { origin, source: ownFrame ? frame.contentWindow : {}, data: { type: 'resize', height: 300 } });
      window.dispatchEvent(event);
    }
  };
}

test('automatic mode follows the system at startup and while the page is open', () => {
  for (const dark of [false, true]) {
    const p = page({ dark });
    assert.equal(p.root.getAttribute('data-mode'), dark ? 'night' : 'day');
    assert.equal(p.root.getAttribute('data-mode-pref'), 'auto');
    assert.equal(p.label.textContent, 'Auto');
    p.system(!dark);
    const next = dark ? 'day' : 'night';
    assert.equal(p.root.getAttribute('data-mode'), next);
    assert.equal(p.meta.getAttribute('content'), dark ? '#f0eee8' : '#191a1c');
    assert.equal(p.events.at(-1).mode, next); // The backdrop receives the resolved mode.
    assert.equal(p.events.at(-1).animate, true);
    assert.match(p.button.getAttribute('aria-label'), dark ? /Auto · Day/ : /Auto · Night/);
    assert.equal(p.storage.has('drift-mode'), false); // System updates do not become manual overrides.
  }
});

test('the button cycles through all preferences, persists them, and resumes system tracking', () => {
  const p = page({ dark: true });
  for (const pref of ['day', 'night', 'auto']) {
    p.click();
    assert.equal(p.root.getAttribute('data-mode-pref'), pref);
    assert.equal(p.storage.get('drift-mode'), pref);
  }
  p.system(false);
  assert.equal(p.root.getAttribute('data-mode'), 'day');
  const reloaded = page({ stored: p.storage.get('drift-mode'), dark: true });
  assert.equal(reloaded.root.getAttribute('data-mode'), 'night');
  assert.equal(reloaded.root.getAttribute('data-mode-pref'), 'auto');
});

test('saved manual choices and explicit site defaults ignore system changes', () => {
  for (const mode of ['day', 'night']) {
    for (const options of [{ stored: mode }, { mode }]) {
      const p = page(options);
      p.system(true);
      p.system(false);
      assert.equal(p.root.getAttribute('data-mode'), mode);
      assert.equal(p.events.length, 1);
    }
  }
  const p = page({ mode: 'night', stored: 'auto' });
  assert.equal(p.root.getAttribute('data-mode'), 'day');
});

test('invalid stored preferences use the configured default', () => {
  assert.equal(page({ stored: 'invalid', mode: 'day' }).root.getAttribute('data-mode'), 'day');
  assert.equal(page({ stored: 'invalid', mode: 'invalid' }).root.getAttribute('data-mode-pref'), 'auto');
});

test('manual switching still works for this page when storage is blocked', () => {
  const p = page({ blocked: true });
  p.click();
  p.click();
  assert.equal(p.root.getAttribute('data-mode'), 'night');
  p.system(false);
  assert.equal(p.root.getAttribute('data-mode'), 'night');
  p.click();
  assert.equal(p.root.getAttribute('data-mode'), 'day');
});

test('legacy media listeners work, and missing matchMedia falls back to night', () => {
  const legacy = page({ media: 'legacy' });
  legacy.system(true);
  assert.equal(legacy.root.getAttribute('data-mode'), 'night');
  const fallback = page({ media: 'none' });
  assert.equal(fallback.root.getAttribute('data-mode'), 'night');
  fallback.click();
  assert.equal(fallback.root.getAttribute('data-mode'), 'day');
});

test('comments catch up after loading and continue following mode changes', () => {
  const p = page({ comments: true });
  assert.equal(p.script.getAttribute('theme'), 'github-light');
  p.system(true); // The iframe has not been created yet.
  p.attachFrame();
  p.resize('https://example.com');
  p.resize('https://utteranc.es', false);
  assert.equal(p.messages.length, 0);
  p.resize();
  assert.deepEqual(p.messages.at(-1), { type: 'set-theme', theme: 'github-dark', origin: 'https://utteranc.es' });
  p.resize();
  assert.equal(p.messages.length, 1); // Ordinary resizes must not reload the stylesheet.
  p.system(false);
  assert.equal(p.messages.at(-1).theme, 'github-light');
});
