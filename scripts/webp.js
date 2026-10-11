'use strict';

// Theme plugin: convert raster images to WebP at build time.
// Sources stay as JPEG/PNG in the repository; only the generated site carries .webp files,
// and every reference in the rendered HTML (asset_img, asset_link, Open Graph) is rewritten.
// Needs the optional `sharp` package (`npm install sharp` in the site); without it the plugin
// logs one warning and leaves images untouched.
// Settings are read from the site _config.yml (`webp:`) and fall back to the theme _config.yml:
//   webp:
//     enable: true
//     quality: 82        # WebP quality
//     max_width: 1600    # wider images are scaled down (never enlarged)
//     min_size: 30720    # bytes; smaller originals are left alone
//     extensions: [jpg, jpeg, png]
//     exclude: []        # regular expressions matched against the route path, added to the built-in list
//
// Favicons and touch icons are always skipped: browsers and iOS expect PNG/ICO there.

const fs = require('node:fs');
const path = require('node:path');

const ALWAYS_EXCLUDE = [/(^|\/)(favicon|apple-touch-icon|android-chrome|mstile)[^/]*$/i];

const DEFAULTS = {
  enable: true,
  quality: 82,
  max_width: 1600,
  min_size: 30 * 1024,
  extensions: ['jpg', 'jpeg', 'png'],
  exclude: []
};

const cache = new Map();       // route path -> { key, webpPath, buffer, originalSize }
let converted = new Map();     // route path -> webp route path (for the current generation)
let sharp = null;

function settings() {
  return Object.assign({}, DEFAULTS, hexo.theme.config.webp || {}, hexo.config.webp || {});
}

function loadSharp() {
  if (sharp !== null) return sharp;
  try {
    sharp = require('sharp');
  } catch (error) {
    hexo.log.warn('webp: the "sharp" package is not installed, images are left untouched (%s)', error.message);
    sharp = false;
  }
  return sharp;
}

function sourceFile(routePath) {
  const asset = hexo.model('PostAsset').findOne({ path: routePath }) || hexo.model('Asset').findOne({ path: routePath });
  return asset && asset.source && fs.existsSync(asset.source) ? asset.source : null;
}

function readRoute(routePath) {
  return new Promise((resolve, reject) => {
    const stream = hexo.route.get(routePath);
    if (!stream) return resolve(null);
    const chunks = [];
    stream.on('data', chunk => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
}

hexo.extend.filter.register('after_generate', async function convertImages() {
  const cfg = settings();
  converted = new Map();
  if (!cfg.enable) return;
  const engine = loadSharp();
  if (!engine) return;

  const extensions = new Set((cfg.extensions || []).map(e => String(e).toLowerCase().replace(/^\./, '')));
  const excludes = ALWAYS_EXCLUDE.concat((cfg.exclude || []).map(pattern => new RegExp(pattern)));
  let count = 0, before = 0, after = 0;

  for (const routePath of hexo.route.list()) {
    const ext = path.extname(routePath).slice(1).toLowerCase();
    if (!extensions.has(ext)) continue;
    if (excludes.some(re => re.test(routePath))) continue;

    const file = sourceFile(routePath);
    let input, key;
    if (file) {
      const stat = fs.statSync(file);
      if (stat.size < cfg.min_size) continue;
      key = `${file}:${stat.mtimeMs}:${stat.size}:${cfg.quality}:${cfg.max_width}`;
      input = () => fs.promises.readFile(file);
    } else {
      const buffer = await readRoute(routePath);
      if (!buffer || buffer.length < cfg.min_size) continue;
      key = `${routePath}:${buffer.length}:${cfg.quality}:${cfg.max_width}`;
      input = () => Promise.resolve(buffer);
    }

    const webpPath = routePath.replace(/\.[^.]+$/, '.webp');
    let entry = cache.get(routePath);
    if (!entry || entry.key !== key) {
      try {
        const source = await input();
        const buffer = await engine(source)
          .rotate()
          .resize({ width: cfg.max_width, withoutEnlargement: true })
          .webp({ quality: cfg.quality, effort: 4 })
          .toBuffer();
        entry = { key, webpPath, buffer, originalSize: source.length };
        cache.set(routePath, entry);
      } catch (error) {
        hexo.log.warn('webp: could not convert %s, keeping the original (%s)', routePath, error.message);
        continue;
      }
    }
    hexo.route.set(webpPath, entry.buffer);
    hexo.route.remove(routePath);
    converted.set(routePath, webpPath);
    count++; before += entry.originalSize; after += entry.buffer.length;
  }
  if (count) {
    hexo.log.info('webp: %d image(s) converted, %s -> %s', count, kb(before), kb(after));
  }
});

function kb(bytes) {
  return bytes >= 1024 * 1024 ? (bytes / 1024 / 1024).toFixed(1) + ' MB' : Math.round(bytes / 1024) + ' KB';
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Rewrite references in every rendered page. Runs after after_generate, so `converted` is complete.
hexo.extend.filter.register('after_render:html', function rewriteImageReferences(html) {
  if (!converted.size || !html) return html;
  for (const [from, to] of converted) {
    if (html.includes(from)) html = html.replace(new RegExp(escapeRegExp(from) + '(?=["\'\\s)?#>])', 'g'), to);
  }
  return html;
}, 30);
