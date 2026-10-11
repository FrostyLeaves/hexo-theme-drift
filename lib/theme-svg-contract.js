'use strict';

/**
 * Theme-aware SVG contract: validation and normalisation helpers.
 * The contract is documented in docs/guide.en.md#svg-contract and docs/guide.zh-CN.md#svg-contract.
 * This module has no Hexo dependency so it can be used from the build
 * plugins (scripts/*.js), from the CLI checker (tools/check-theme-svg.js)
 * and from tests.
 */

const THEME_INPUT_TOKENS = {
  '--diagram-background': 'page or panel background the diagram sits on',
  '--diagram-text': 'primary ink: text, outlines, arrows',
  '--diagram-accent': 'single accent colour of the theme',
  '--diagram-teal': 'optional category colour 1; without it the diagram derives one from the accent',
  '--diagram-blue': 'optional category colour 2',
  '--diagram-purple': 'optional category colour 3',
  '--diagram-orange': 'optional category colour 4',
  '--diagram-font': 'optional font stack (falls back to the system sans stack)'
};

const DERIVED_TOKENS = {
  '--d-bg': 'background; equals --diagram-background',
  '--d-ink': 'primary ink; equals --diagram-text',
  '--d-accent': 'accent; equals --diagram-accent',
  '--d-muted': 'secondary text and thin guides (ink 68%)',
  '--d-border': 'box outlines and separators (ink 19%)',
  '--d-surface': 'box fills barely lifted from the background (ink 3%)',
  '--d-shadow': 'drop shadows (black 35% over the background)',
  '--d-teal': 'category colour 1: --diagram-teal when the theme supplies it, else derived from the accent',
  '--d-blue': 'category colour 2: --diagram-blue or derived',
  '--d-purple': 'category colour 3: --diagram-purple or derived',
  '--d-orange': 'category colour 4: --diagram-orange or derived'
};

/** The canonical <style> block every contract SVG carries right after <title>/<desc>. */
const TOKEN_STYLE = `<style>
.theme-diagram {
  --d-bg: var(--diagram-background, #ffffff);
  --d-ink: var(--diagram-text, #383838);
  --d-accent: var(--diagram-accent, #2bbc8a);
  --d-muted: color-mix(in srgb, var(--d-ink) 68%, var(--d-bg));
  --d-border: color-mix(in srgb, var(--d-ink) 19%, var(--d-bg));
  --d-surface: color-mix(in srgb, var(--d-ink) 3%, var(--d-bg));
  --d-shadow: color-mix(in srgb, #000000 35%, var(--d-bg));
  --d-teal: var(--diagram-teal, color-mix(in srgb, var(--d-accent) 76%, var(--d-ink)));
  --d-blue: var(--diagram-blue, color-mix(in srgb, var(--d-accent) 28%, #6c91bc));
  --d-purple: var(--diagram-purple, color-mix(in srgb, var(--d-accent) 15%, #a18ab9));
  --d-orange: var(--diagram-orange, color-mix(in srgb, var(--d-accent) 10%, #d3a462));
  font-family: var(--diagram-font, -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif);
}
.theme-diagram text { font-family: inherit; }
</style>`;

const COLOR_PROPS = new Set(['fill', 'stroke', 'stop-color', 'flood-color', 'lighting-color', 'color']);

const NAMED_COLORS = new Set(('aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue blueviolet brown ' +
  'burlywood cadetblue chartreuse chocolate coral cornflowerblue cornsilk crimson cyan darkblue darkcyan darkgoldenrod darkgray ' +
  'darkgreen darkgrey darkkhaki darkmagenta darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen darkslateblue ' +
  'darkslategray darkslategrey darkturquoise darkviolet deeppink deepskyblue dimgray dimgrey dodgerblue firebrick floralwhite ' +
  'forestgreen fuchsia gainsboro ghostwhite gold goldenrod gray green greenyellow grey honeydew hotpink indianred indigo ivory khaki ' +
  'lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan lightgoldenrodyellow lightgray lightgreen lightgrey ' +
  'lightpink lightsalmon lightseagreen lightskyblue lightslategray lightslategrey lightsteelblue lightyellow lime limegreen linen ' +
  'magenta maroon mediumaquamarine mediumblue mediumorchid mediumpurple mediumseagreen mediumslateblue mediumspringgreen ' +
  'mediumturquoise mediumvioletred midnightblue mintcream mistyrose moccasin navajowhite navy oldlace olive olivedrab orange ' +
  'orangered orchid palegoldenrod palegreen paleturquoise palevioletred papayawhip peachpuff peru pink plum powderblue purple ' +
  'rebeccapurple red rosybrown royalblue saddlebrown salmon sandybrown seagreen seashell sienna silver skyblue slateblue slategray ' +
  'slategrey snow springgreen steelblue tan teal thistle tomato turquoise violet wheat white whitesmoke yellow yellowgreen').split(' '));

const LITERAL_COLOR = /#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch)\(/i;

function hasLiteralColor(value) {
  if (LITERAL_COLOR.test(value)) return true;
  return value.split(/[\s,()/]+/).some(token => NAMED_COLORS.has(token.toLowerCase()));
}

/** A colour value is acceptable when it is derived from the theme tokens or is a non-colour keyword. */
function isThemeDerived(value) {
  const v = String(value).trim();
  if (/^(none|transparent|currentcolor|inherit|initial|unset|context-fill|context-stroke)$/i.test(v)) return true;
  if (/^url\(\s*#/.test(v)) return true;
  if (/^var\(/.test(v)) return true;
  if (/^color-mix\(/.test(v) && /var\(/.test(v)) return true;
  if (!hasLiteralColor(v)) return true; // e.g. a bare number or an unknown keyword; not a literal colour
  return false;
}

function stripComments(text) {
  return text.replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
}

function snippet(text, max) {
  const one = text.replace(/\s+/g, ' ').trim();
  return one.length > (max || 110) ? one.slice(0, max || 110) + '…' : one;
}

/**
 * validate(svgText) -> { ok, errors: [{ code, message, where }] }
 */
function validate(svgText, options) {
  const errors = [];
  const push = (code, message, where) => errors.push({ code, message, where: where ? snippet(where) : undefined });
  const text = stripComments(String(svgText));

  const rootMatch = text.match(/<svg\b([^>]*)>/);
  if (!rootMatch) {
    push('root', 'no <svg> root element');
    return { ok: false, errors };
  }
  const rootAttrs = rootMatch[1];
  if (!/\bdata-theme-svg="1"/.test(rootAttrs)) push('root-marker', 'root <svg> needs data-theme-svg="1"', rootMatch[0]);
  if (!/\bviewBox="[^"]+"/.test(rootAttrs)) push('root-viewbox', 'root <svg> needs a viewBox', rootMatch[0]);
  if (!/\bxmlns="http:\/\/www\.w3\.org\/2000\/svg"/.test(rootAttrs)) push('root-xmlns', 'root <svg> needs xmlns="http://www.w3.org/2000/svg"', rootMatch[0]);
  if (!/<title\b[^>]*>\s*\S[\s\S]*?<\/title>/.test(text)) push('title', 'a non-empty <title> is required for accessibility');

  if (/<script\b/i.test(text)) push('forbidden-element', '<script> is not allowed');
  if (/<foreignObject\b/i.test(text)) push('forbidden-element', '<foreignObject> is not allowed');
  if (/<image\b/i.test(text)) push('forbidden-element', '<image> (embedded raster) is not allowed');
  const handler = text.match(/\son[a-z]+\s*=/i);
  if (handler) push('forbidden-attr', 'event handler attributes are not allowed', handler[0]);
  const external = text.match(/(?:href|src)\s*=\s*"(?:https?:)?\/\/[^"]*"|url\(\s*["']?(?:https?:)?\/\//i);
  if (external) push('external-ref', 'external references are not allowed; diagrams must be self-contained', external[0]);
  if (/@import\b/.test(text)) push('external-ref', '@import is not allowed');

  if (!/--diagram-background/.test(text) || !/--diagram-text/.test(text)) {
    push('tokens', 'the diagram must read its colours from --diagram-background and --diagram-text (use the canonical <style> block)');
  }

  // <style> blocks: literals are only allowed inside custom property definitions.
  const styleBlocks = [...text.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)];
  for (const block of styleBlocks) {
    const css = block[1];
    for (const rule of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      for (const decl of rule[2].split(';')) {
        const idx = decl.indexOf(':');
        if (idx < 0) continue;
        const prop = decl.slice(0, idx).trim();
        const value = decl.slice(idx + 1).trim();
        if (prop.startsWith('--')) continue;
        if (COLOR_PROPS.has(prop) && !isThemeDerived(value)) {
          push('style-literal-color', `literal colour in <style>: ${prop}: ${value}`, rule[1].trim() + ' { … }');
        }
      }
    }
  }

  // Element attributes: colours must come from tokens.
  const withoutStyle = text.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');
  for (const el of withoutStyle.matchAll(/<([a-zA-Z][\w:-]*)\b([^>]*)>/g)) {
    const [whole, tag, attrs] = el;
    if (tag === 'svg' || tag === 'title' || tag === 'desc') continue;
    for (const attr of attrs.matchAll(/([\w:-]+)\s*=\s*"([^"]*)"/g)) {
      const [, name, value] = attr;
      if (COLOR_PROPS.has(name)) {
        if (!isThemeDerived(value)) push('literal-color', `<${tag} ${name}="${value}"> uses a literal colour`, whole);
      } else if (name === 'style') {
        for (const decl of value.split(';')) {
          const idx = decl.indexOf(':');
          if (idx < 0) continue;
          const prop = decl.slice(0, idx).trim();
          const v = decl.slice(idx + 1).trim();
          if (COLOR_PROPS.has(prop) && !isThemeDerived(v)) push('literal-color', `<${tag} style="${prop}: ${v}"> uses a literal colour`, whole);
        }
      }
    }
  }

  return { ok: errors.length === 0, errors };
}

function formatErrors(result, file) {
  const lines = result.errors.map(e => `  - [${e.code}] ${e.message}${e.where ? '\n      ' + e.where : ''}`);
  return `theme_svg: ${file} does not follow the SVG contract (see docs/guide.en.md#svg-contract):\n${lines.join('\n')}`;
}

function escapeXml(text) {
  return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Prefix every id (and its url(#id) / href="#id" references) so several inlined copies cannot collide. */
function namespaceIds(svg, prefix) {
  const ids = [...svg.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
  for (const id of ids) {
    const next = `${prefix}-${id}`;
    svg = svg.split(`id="${id}"`).join(`id="${next}"`)
      .split(`url(#${id})`).join(`url(#${next})`)
      .split(`href="#${id}"`).join(`href="#${next}"`);
  }
  return svg.replace(/aria-labelledby="([^"]+)"/g, (_, labels) =>
    `aria-labelledby="${labels.split(/\s+/).map(id => ids.includes(id) ? prefix + '-' + id : id).join(' ')}"`);
}

const KROKI_NAMED = {
  white: 'ffffff', black: '000000', gray: '969696', grey: '969696', silver: 'c0c0c0',
  red: 'ff0000', green: '008000', blue: '0000ff', yellow: 'ffff00', orange: 'ffa500', pink: 'ffc0cb', purple: '800080'
};

/** Which category token a literal colour lands on, by hue; null for greys. */
function categoryFor(hex6) {
  const [r, g, b] = [0, 2, 4].map(i => parseInt(hex6.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  if (d < 0.08) return null;
  let h;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h = (h * 60 + 360) % 360;
  if (h >= 70 && h < 200) return '--d-teal';
  if (h >= 200 && h < 265) return '--d-blue';
  if (h >= 265 && h < 345) return '--d-purple';
  return '--d-orange';
}

/**
 * Map one literal colour from a Kroki SVG onto the token vocabulary: white and black become
 * background and ink, greys become the shadow or a neutral surface, and every other colour goes
 * to the category colour closest in hue (as a 40% tint for fills, solid for strokes), so diagrams
 * use the theme's own category palette instead of ditaa's.
 */
function mapKrokiColor(prop, raw) {
  const value = String(raw).trim();
  if (isThemeDerived(value)) return value; // none, url(#…), var(), already mapped …
  let c = null;
  const hex = value.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  const rgb = value.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (hex) {
    c = hex[1].toLowerCase();
    if (c.length === 3) c = c.split('').map(ch => ch + ch).join('');
  } else if (KROKI_NAMED[value.toLowerCase()]) {
    c = KROKI_NAMED[value.toLowerCase()];
  } else if (rgb) {
    c = [1, 2, 3].map(i => Math.min(255, Number(rgb[i])).toString(16).padStart(2, '0')).join('');
  }
  if (!c) return prop === 'fill' ? 'var(--d-surface)' : 'var(--d-muted)';
  if (c === 'ffffff') return 'var(--d-bg)';
  if (c === '000000') return 'var(--d-ink)';
  const category = categoryFor(c);
  if (!category) {
    if (c === '969696') return 'var(--d-shadow)';
    return prop === 'fill' ? 'var(--d-surface)' : 'var(--d-muted)';
  }
  return prop === 'fill' ? `color-mix(in srgb, var(${category}) 40%, var(--d-bg))` : `var(${category})`;
}

/**
 * Replace a diagram's token <style> block with the canonical TOKEN_STYLE (used after the contract
 * changes). Returns { svg, changed }; files without a token block are left alone.
 */
function updateTokens(svgText) {
  const text = String(svgText);
  const re = /<style\b[^>]*>[\s\S]*?<\/style>/i;
  const match = text.match(re);
  if (!match || !/--diagram-background/.test(match[0])) return { svg: text, changed: false };
  if (match[0].replace(/\r\n/g, '\n') === TOKEN_STYLE) return { svg: text, changed: false };
  return { svg: text.replace(re, TOKEN_STYLE), changed: true };
}

/**
 * Turn an SVG produced by Kroki (ditaa and friends) into a contract-compliant diagram:
 * canonical root attributes, <title>, the token <style> block, prefixed ids and token colours.
 */
function normalizeKroki(svgText, options) {
  const { lang, hash, title } = options;
  let svg = String(svgText).replace(/<\?xml[^>]*\?>\s*/i, '').replace(/<!DOCTYPE[^>]*>\s*/i, '').trim();
  const root = svg.match(/^<svg\b([^>]*)>/);
  if (!root) throw new Error('kroki response is not an SVG document');
  let attrs = root[1];
  const width = (attrs.match(/\bwidth="([\d.]+)(?:px)?"/) || [])[1];
  const height = (attrs.match(/\bheight="([\d.]+)(?:px)?"/) || [])[1];
  if (!/\bviewBox=/.test(attrs) && width && height) attrs += ` viewBox="0 0 ${width} ${height}"`;
  attrs = attrs.replace(/\s(?:width|height|class|data-theme-svg|role|aria-labelledby|data-diagram)="[^"]*"/g, '');
  if (!/\bxmlns="http:\/\/www\.w3\.org\/2000\/svg"/.test(attrs)) attrs += ' xmlns="http://www.w3.org/2000/svg"';
  const prefix = `${lang}-${String(hash).slice(0, 8)}`;
  attrs += ` class="theme-diagram" data-theme-svg="1" data-diagram="${lang}" role="img" aria-labelledby="${prefix}-title"`;

  let body = svg.slice(root[0].length).replace(/<\/svg>\s*$/, '');
  body = body.replace(/<title\b[^>]*>[\s\S]*?<\/title>/gi, '');
  body = namespaceIds(body, prefix);
  body = body.replace(/\b(fill|stroke|stop-color|flood-color)="([^"]*)"/gi, (m, prop, value) => `${prop}="${mapKrokiColor(prop, value)}"`);
  body = body.replace(/style="([^"]*)"/g, (m, css) =>
    'style="' + css.replace(/\b(fill|stroke|stop-color|flood-color)\s*:\s*([^;"]+)/gi, (mm, prop, value) => `${prop}: ${mapKrokiColor(prop, value)}`) + '"');
  body = body.replace(/\sfont-family="[^"]*"/g, '');

  const out = `<svg${attrs}>\n<title id="${prefix}-title">${escapeXml(title || lang + ' diagram')}</title>\n${TOKEN_STYLE}\n${body.trim()}\n</svg>\n`;
  const check = validate(out);
  if (!check.ok) throw new Error(formatErrors(check, `${lang}:${String(hash).slice(0, 8)} (after normalisation)`));
  return out;
}

module.exports = { THEME_INPUT_TOKENS, DERIVED_TOKENS, TOKEN_STYLE, validate, formatErrors, namespaceIds, normalizeKroki, updateTokens, escapeXml };
