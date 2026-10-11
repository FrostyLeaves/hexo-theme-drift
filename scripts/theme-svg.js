'use strict';

// Theme plugin: theme-aware inline SVG diagrams.
//   {% theme_svg figure.svg An accessible description %}
// Text diagrams (```ditaa ...) arrive through scripts/diagrams.js, which emits the same slot.
// Every embedded file is checked against docs/guide.en.md#svg-contract; a violation fails the build
// unless `theme_svg.strict: false` is set (then it is only logged).
// Settings are read from the site _config.yml (`theme_svg:`) and fall back to the theme _config.yml.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { escapeHTML, url_for } = require('hexo-util');
const contract = require('../lib/theme-svg-contract');

const MARKER = /<div data-theme-svg-slot="([A-Za-z0-9+/=]+)"><\/div>/g;
const DEFAULTS = { background: '#ffffff', text: '#383838', accent: '#2bbc8a' };
// Category colours are optional: a theme that defines the CSS variables (or configures the colours)
// hands its own four to every diagram; otherwise the SVG derives them from the accent.
const OPTIONAL = ['teal', 'blue', 'purple', 'orange'];
const VARIABLES = {
  background: '--color-background',
  text: '--color-text',
  accent: '--color-accent-1',
  teal: '--color-diagram-teal',
  blue: '--color-diagram-blue',
  purple: '--color-diagram-purple',
  orange: '--color-diagram-orange'
};
const validated = new Map(); // absolute path -> { mtimeMs, size }

function settings() {
  return Object.assign({}, hexo.theme.config.theme_svg || {}, hexo.config.theme_svg || {});
}

function palette() {
  return { ...DEFAULTS, ...(settings().colors || {}) };
}

function paletteStyle(inline) {
  const colors = palette();
  const variables = { ...VARIABLES, ...(settings().css_variables || {}) };
  const out = [];
  for (const key of Object.keys(DEFAULTS).concat(OPTIONAL)) {
    const variable = variables[key];
    const value = colors[key];
    if (inline && /^--[\w-]+$/.test(variable || '')) {
      // no configured colour: var() without a fallback stays invalid when the theme lacks the
      // variable, and the SVG's own fallback formula takes over
      out.push(`--diagram-${key}:var(${variable}${value ? ', ' + value : ''})`);
    } else if (value) {
      out.push(`--diagram-${key}:${value}`);
    }
  }
  return out.join(';');
}

function readDiagram(relative) {
  const base = fs.realpathSync(hexo.source_dir);
  const filename = fs.realpathSync(path.resolve(base, relative));
  if (!filename.startsWith(base + path.sep) || path.extname(filename) !== '.svg') {
    throw new Error('theme_svg only accepts SVG files inside source/');
  }
  const stat = fs.statSync(filename);
  const svg = fs.readFileSync(filename, 'utf8').trim();
  const cached = validated.get(filename);
  if (!cached || cached.mtimeMs !== stat.mtimeMs || cached.size !== stat.size) {
    const display = String(relative).split(path.sep).join('/');
    const result = contract.validate(svg, { file: display });
    if (!result.ok) {
      const message = contract.formatErrors(result, display);
      if (settings().strict === false) hexo.log.warn(message);
      else throw new Error(message);
    }
    validated.set(filename, { mtimeMs: stat.mtimeMs, size: stat.size });
  }
  return svg;
}

function withPalette(svg, inline) {
  return svg.replace(/<svg\b/, `<svg style="${escapeHTML(paletteStyle(inline))}"`);
}

hexo.extend.tag.register('theme_svg', function themeSvg(args) {
  const [filename, ...description] = args;
  if (!filename || !filename.endsWith('.svg')) {
    throw new Error('theme_svg requires an SVG filename: {% theme_svg figure.svg Description %}');
  }
  const asset = hexo.model('PostAsset').findOne({ post: this._id, slug: filename });
  if (!asset) throw new Error(`theme_svg: missing post asset ${filename}`);
  const relative = path.relative(hexo.source_dir, asset.source).split(path.sep).join('/');
  readDiagram(relative);
  const data = { source: relative, url: url_for.call(hexo, asset.path), description: description.join(' ') || filename, kind: 'asset' };
  // Keep a placeholder in Hexo's post cache. Read and theme the actual SVG at
  // layout render time so asset edits and colour changes do not leave stale SVGs.
  return `<div data-theme-svg-slot="${Buffer.from(JSON.stringify(data)).toString('base64')}"></div>`;
});

hexo.extend.filter.register('after_render:html', function renderDiagrams(html) {
  if (!html.includes('data-theme-svg-slot=')) return html;
  let index = 0;
  html = html.replace(MARKER, (_, encoded) => {
    const data = JSON.parse(Buffer.from(encoded, 'base64').toString('utf8'));
    const prefix = 'diagram-' + crypto.createHash('sha256').update(data.source).digest('hex').slice(0, 10) + '-' + index++;
    const svg = contract.namespaceIds(withPalette(readDiagram(data.source), true), prefix);
    const kind = /^[\w-]+$/.test(data.kind || '') ? data.kind : 'asset';
    const label = escapeHTML(data.description || '');
    const inner = data.url
      ? `<a class="theme-svg-link" href="${escapeHTML(data.url)}" target="_blank" rel="noopener" aria-label="${label}">${svg}</a>`
      : `<div class="theme-svg-panel" role="group" aria-label="${label}">${svg}</div>`;
    return `<figure class="theme-svg-figure theme-svg-figure--${kind}">${inner}</figure>`;
  });
  const css = `<style id="theme-svg-layout">
.theme-svg-figure{margin:1.7rem 0;max-width:100%;line-height:0}
.theme-svg-figure .theme-svg-link,.theme-svg-figure .theme-svg-panel{display:block;background-image:none!important;text-decoration:none!important;border:0;border-radius:10px;overflow:hidden}
.theme-svg-figure .theme-diagram{display:block;width:100%;height:auto;max-width:100%}
.theme-svg-figure .theme-diagram,.theme-svg-figure .theme-diagram *{transition:fill .3s ease,stroke .3s ease}
.theme-svg-figure .theme-svg-link:focus-visible{outline:2px solid currentColor;outline-offset:4px}
@media (prefers-reduced-motion:reduce){.theme-svg-figure .theme-diagram,.theme-svg-figure .theme-diagram *{transition:none}}
@media print{.theme-svg-figure{break-inside:avoid}}
</style>`;
  return html.includes('</head>') ? html.replace('</head>', css + '</head>') : css + html;
}, 20);

hexo.extend.filter.register('after_generate', function themeStandaloneAssets() {
  // The clickable/downloadable SVG uses the build-time palette (`theme_svg.colors`).
  // Source files stay untouched when the site's colours change.
  for (const asset of hexo.model('PostAsset').toArray()) {
    if (!asset.slug.endsWith('.svg') || !fs.existsSync(asset.source)) continue;
    const raw = fs.readFileSync(asset.source, 'utf8');
    if (!/^<svg\b[^>]*\bdata-theme-svg="1"/.test(raw)) continue;
    const svg = readDiagram(path.relative(hexo.source_dir, asset.source).split(path.sep).join('/'));
    hexo.route.set(asset.path, withPalette(svg, false));
  }
});
