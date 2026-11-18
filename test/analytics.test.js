'use strict';
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const { umamiOptions } = require('../lib/analytics');
const id = '94db1cb1-74f4-4a40-ad6c-962362670409';
const settings = { enabled: true, website_id: id, script_url: 'https://stats.example.com/script.js', allowed_origins: ['https://example.com'] };
const theme = umami => ({ analytics: { umami } });
const site = { url: 'https://example.com/blog', root: '/blog/' };
const config = umamiOptions(theme(settings), site);
const source = readFileSync(require.resolve('../source/js/analytics.js'), 'utf8');

function page(url = 'https://example.com/blog/post/?secret=abc#private', options = {}) {
  const appended = [], calls = [];
  const window = { location: new URL(url), screen: { width: 1920, height: 1080 } };
  if (options.existing) window.umami = {};
  const context = { window, navigator: { language: 'zh-CN' }, URL, document: {
    title: 'A post', referrer: 'https://source.example/article?secret=1#private',
    getElementById: () => options.missing ? null : { textContent: options.broken ? '{' : JSON.stringify(config) },
    createElement: () => ({ attrs: {}, setAttribute(k, v) { this.attrs[k] = v; } }),
    head: { appendChild(script) { appended.push(script); } }
  } };
  function run() { vm.runInNewContext(source, context); }
  function load(track) { window.umami = { track: track || (payload => { calls.push(payload); return Promise.resolve(); }) }; appended[0].onload(); }
  run();
  return { window, appended, calls, run, load };
}

test('disabled and incomplete settings emit no configuration', () => {
  for (const opt of [{}, { ...settings, enabled: false }, { ...settings, enabled: 'true' }, { ...settings, website_id: 'fake' }, { ...settings, script_url: '' }]) assert.equal(umamiOptions(theme(opt), site), null);
  assert.equal(umamiOptions({}, site), null);
});
test('valid Cloud/self-hosted configuration normalises root and defaults to the site origin', () => {
  assert.equal(config.path, '/blog');
  assert.equal(umamiOptions(theme({ ...settings, allowed_origins: [], script_url: 'https://cloud.umami.is/script.js' }), site).allowed_origins[0], 'https://example.com');
  assert.equal(umamiOptions(theme(settings), { url: site.url }).path, '/blog');
});
test('build-time origin isolation and unsafe configurations fail closed', () => {
  assert.equal(umamiOptions(theme(settings), { url: 'https://mirror.example.com', root: '/' }), null);
  for (const script_url of ['javascript:alert(1)', 'http://stats.example.com/a.js', 'https://user:pass@stats.example.com/a.js', 'https://localhost/script.js', 'https://stats.example.com/a.js?key=secret']) assert.equal(umamiOptions(theme({ ...settings, script_url }), site), null);
  for (const path of ['blog', '//other.test', '/blog?x=1', '/blog\\x']) assert.equal(umamiOptions(theme({ ...settings, path }), site), null);
  assert.equal(umamiOptions(theme({ ...settings, allowed_origins: [] }), { url: 'https://localhost', root: '/' }), null);
});
test('runtime rejects mirrors, preview/local hosts, other ports and path-prefix lookalikes before loading tracker', () => {
  for (const url of ['https://mirror.example.com/blog/a', 'https://preview.example.com/blog/a', 'http://localhost:4000/blog/a', 'https://example.com:8443/blog/a', 'https://example.com/blogger/a', 'https://example.com/']) assert.equal(page(url).appended.length, 0, url);
  for (const url of ['https://example.com/blog', 'https://example.com/blog/', 'https://example.com/blog/a']) assert.equal(page(url).appended.length, 1, url);
});
test('one tracker and manual pageview with sanitised URL/referrer; no automatic collection', () => {
  const p = page(); p.run(); assert.equal(p.appended.length, 1);
  const script = p.appended[0]; assert.equal(script.attrs['data-auto-track'], 'false'); assert.equal(script.referrerPolicy, 'no-referrer');
  p.load(); assert.equal(p.calls.length, 1); assert.equal(p.calls[0].url, '/blog/post/'); assert.equal(p.calls[0].referrer, 'https://source.example');
  assert.ok(!JSON.stringify(p.calls).includes('secret'));
  assert.equal(page(undefined, { existing: true }).appended.length, 0);
});
test('missing, invalid, blocked or failing trackers do not break the page', () => {
  assert.equal(page(undefined, { missing: true }).appended.length, 0);
  assert.equal(page(undefined, { broken: true }).appended.length, 0);
  assert.doesNotThrow(() => page().load(() => { throw new Error('blocked'); }));
  assert.doesNotThrow(() => page().load(() => Promise.reject(new Error('offline'))));
  // A later same-document navigation outside the prefix is also blocked.
  const q = page(); q.window.location.pathname = '/outside'; q.load(); assert.equal(q.calls.length, 0);
});
