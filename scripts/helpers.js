'use strict';

const { stripHTML, escapeHTML } = require('hexo-util');
const { cardEffect } = require('../lib/theme-options');

hexo.extend.helper.register('card_effect', function () {
  return cardEffect((this.theme.juice || {}).foil);
});

const CJK = /[㐀-䶿一-鿿豈-﫿぀-ヿ가-힯]/g;

/** Small stable hash so a category keeps the same colour on every build. */
function tone(text, n) {
  let h = 7;
  for (const ch of String(text || '')) h = (Math.imul(h, 31) + ch.codePointAt(0)) >>> 0;
  return n ? h % n : h;
}

function palettePool(theme) {
  const palettes = (theme && theme.palettes) || {};
  const names = Object.keys(palettes);
  const cfg = (theme && theme.palette) || {};
  const pool = (Array.isArray(cfg.pool) ? cfg.pool : names).filter(name => palettes[name]);
  return pool.length ? pool : names;
}

/**
 * reading_time(post) -> { words, minutes }
 * CJK text is counted per character, everything else per word.
 */
hexo.extend.helper.register('reading_time', function (post) {
  const speed = (this.theme && this.theme.post && this.theme.post.reading_speed) || {};
  const text = stripHTML(post.content || '');
  const cjk = (text.match(CJK) || []).length;
  const latin = (text.replace(CJK, ' ').match(/[A-Za-z0-9_][A-Za-z0-9_'’-]*/g) || []).length;
  const minutes = Math.max(1, Math.round(cjk / (speed.cjk || 400) + latin / (speed.latin || 200)));
  return { words: cjk + latin, minutes };
});

/**
 * post_excerpt(post, length) -> plain-text summary.
 * Priority: front-matter description, text before <!-- more -->, then the start of the content.
 */
hexo.extend.helper.register('post_excerpt', function (post, length) {
  let text = '';
  if (post.description) text = String(post.description);
  else if (post.excerpt) text = stripHTML(post.excerpt);
  else text = stripHTML(post.content || '');
  text = text.replace(/\s+/g, ' ').trim();
  const max = length || 140;
  return text.length > max ? text.slice(0, max).trim() + '…' : text;
});

/**
 * category_tone(name) -> { palette }
 * The palette a category maps to (one of palette.pool); cards and category pills take their
 * colour mark from it.
 */
hexo.extend.helper.register('category_tone', function (name) {
  const pool = palettePool(this.theme);
  return { palette: pool[tone(name, pool.length || 1)] || '' };
});

/**
 * post_number(post) -> 1-based position of the post in publication order (oldest = 1).
 * Printed in the corners of the list cards; stable as long as older posts keep their dates.
 */
hexo.extend.helper.register('post_number', function (post) {
  const posts = this.site && this.site.posts;
  if (!posts || !post) return 0;
  const list = posts.sort('date').toArray();
  const index = list.findIndex(item => item._id === post._id);
  return index < 0 ? 0 : index + 1;
});

/**
 * page_palette(page) -> palette name for the page being rendered.
 * Front-matter `palette:` wins; otherwise theme.palette.<kind>, with `post: auto` hashing the
 * first category into the pool so every category keeps one colour.
 */
hexo.extend.helper.register('page_palette', function (page) {
  const theme = this.theme || {};
  const palettes = theme.palettes || {};
  const names = Object.keys(palettes);
  if (!names.length) return '';
  const cfg = theme.palette || {};
  const valid = name => (name && palettes[name] ? name : null);
  const first = names[0];
  page = page || this.page || {};
  if (valid(page.palette)) return page.palette;
  if (this.is_home()) return valid(cfg.home) || first;
  if (this.is_post()) {
    if (cfg.post && cfg.post !== 'auto') return valid(cfg.post) || first;
    const pool = palettePool(theme);
    const cats = page.categories && page.categories.toArray ? page.categories.toArray() : (page.categories || []);
    const key = cats.length ? cats[0].name : page.title;
    return pool[tone(key, pool.length)] || first;
  }
  if (this.is_category() || page.type === 'categories') return valid(cfg.category) || first;
  if (this.is_tag() || page.type === 'tags') return valid(cfg.tag) || first;
  if (this.is_archive()) return valid(cfg.archive) || first;
  if (this.path === '404.html' || page.title === '404') return valid(cfg.error) || first;
  return valid(cfg.page) || first;
});

const SCENES = ['sky', 'ocean'];

/**
 * background_setup() -> { enable, style, styles, mode }
 * The scenes readers can cycle through (theme.background.styles, filtered to the ones the theme
 * ships), the default one (theme.background.style) and the default mode preference.
 */
hexo.extend.helper.register('background_setup', function () {
  const bg = (this.theme && this.theme.background) || {};
  let styles = Array.isArray(bg.styles) ? bg.styles.map(String).filter(name => SCENES.includes(name)) : SCENES.slice();
  if (!styles.length) styles = SCENES.slice();
  const style = styles.includes(bg.style) ? bg.style : styles[0];
  const mode = ['auto', 'day', 'night'].includes(bg.mode) ? bg.mode : 'auto';
  return { enable: bg.enable !== false, style, styles, mode };
});

/** background_label(name) -> languages background.<name>, then the name. */
hexo.extend.helper.register('background_label', function (name) {
  const key = 'background.' + name;
  const text = this.ui_label(key);
  return text === key ? name : text;
});

/**
 * letter_spans(text, className) -> HTML with one <span> per character for lettering animations.
 * Latin words are wrapped in a no-break <span class="w"> so they never break mid-word; CJK
 * characters stay individual so long titles still wrap anywhere. Put aria-label on the parent:
 * the spans are aria-hidden.
 */
hexo.extend.helper.register('letter_spans', function (text, className) {
  let index = 0;
  const cls = escapeHTML(String(className || 'ch'));
  const letter = ch => `<span class="${cls}" style="--i:${index++}" aria-hidden="true">${escapeHTML(ch)}</span>`;
  const tokens = String(text || '').match(/[A-Za-z0-9'’-]+|\s+|[\s\S]/gu) || [];
  return tokens.map(token => {
    if (/^\s+$/.test(token)) return ' ';
    if (/^[A-Za-z0-9'’-]+$/.test(token)) return `<span class="w">${Array.from(token).map(letter).join('')}</span>`;
    return Array.from(token).map(letter).join('');
  }).join('');
});

/** palette_label(name) -> human label: palettes.<name>.label, then languages palette.<name>, then the name. */
hexo.extend.helper.register('palette_label', function (name) {
  const palettes = (this.theme && this.theme.palettes) || {};
  const entry = palettes[name] || {};
  if (entry.label) return String(entry.label);
  const key = 'palette.' + name;
  const text = this.ui_label(key);
  return text === key ? name : text;
});
