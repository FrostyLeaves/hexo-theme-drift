'use strict';

// Theme plugin: text diagrams (ditaa, ...) rendered through Kroki once, cached as
// contract-compliant SVG under <site>/source/_diagrams/<lang>/<sha1>.svg, and embedded through
// the same theme-aware pipeline as {% theme_svg %}. Commit the cache: builds and deploys then
// never need the network; only a new or edited diagram does. See docs/guide.en.md#diagrams.
// Settings are read from the site _config.yml (`diagrams:`) and fall back to the theme _config.yml.

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { normalizeKroki } = require('../lib/theme-svg-contract');

const DEFAULTS = {
  enable: true,
  server: 'https://kroki.io',
  languages: ['ditaa'],
  cache_dir: 'source/_diagrams',
  timeout: 30000
};

function settings() {
  return Object.assign({}, DEFAULTS, hexo.theme.config.diagrams || {}, hexo.config.diagrams || {});
}

function slot(data) {
  return `<div data-theme-svg-slot="${Buffer.from(JSON.stringify(data)).toString('base64')}"></div>`;
}

async function render(server, lang, body, timeout) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(`${server.replace(/\/$/, '')}/${lang}/svg`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain; charset=utf-8', Accept: 'image/svg+xml' },
      body,
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`kroki responded ${response.status} ${response.statusText}`);
    return await response.text();
  } finally {
    clearTimeout(timer);
  }
}

hexo.extend.filter.register('before_post_render', async function diagrams(data) {
  const cfg = settings();
  if (!cfg.enable || !data.content) return data;
  const languages = (cfg.languages || []).map(l => String(l).toLowerCase());
  if (!languages.length) return data;

  const fence = new RegExp('^([ \\t]*)```(' + languages.join('|') + ')([^\\n]*)\\n([\\s\\S]*?)\\n[ \\t]*```[ \\t]*$', 'gm');
  const matches = [...data.content.matchAll(fence)];
  if (!matches.length) return data;

  const cacheRoot = path.resolve(hexo.base_dir, cfg.cache_dir);
  let content = data.content;
  for (const match of matches.reverse()) {
    const [whole, , langRaw, info, body] = match;
    const lang = langRaw.toLowerCase();
    const hash = crypto.createHash('sha1').update(lang + '\n' + body.replace(/\r\n/g, '\n')).digest('hex');
    const file = path.join(cacheRoot, lang, hash + '.svg');
    const relative = path.relative(hexo.source_dir, file).split(path.sep).join('/');
    const title = info.trim() || `${lang} diagram`;

    if (!fs.existsSync(file)) {
      try {
        const raw = await render(cfg.server, lang, body, cfg.timeout);
        const svg = normalizeKroki(raw, { lang, hash, title });
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, svg, 'utf8');
        hexo.log.info('diagrams: rendered %s block via Kroki -> %s', lang, relative);
      } catch (error) {
        hexo.log.warn('diagrams: %s block in %s left as a code block: %s', lang, data.source, error.message);
        continue;
      }
    }
    const replacement = '\n' + slot({ source: relative, url: null, description: title, kind: lang }) + '\n';
    content = content.slice(0, match.index) + replacement + content.slice(match.index + whole.length);
  }
  data.content = content;
  return data;
}, 5);
