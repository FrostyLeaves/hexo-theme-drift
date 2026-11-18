'use strict';

function publicOrigin(value) {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    if (url.protocol !== 'https:' || url.username || url.password || host === 'localhost' || host.endsWith('.localhost') || host === '[::1]' || /^127\./.test(host)) return null;
    return url.origin;
  } catch (_) { return null; }
}

function umamiOptions(theme = {}, site = {}) {
  const options = (theme.analytics || {}).umami || {};
  if (options.enabled !== true || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(options.website_id || '')) return null;
  let script;
  let siteUrl;
  try { script = new URL(options.script_url); siteUrl = new URL(site.url); } catch (_) { return null; }
  if (!publicOrigin(script.href) || script.search || script.hash) return null;
  const origins = Array.isArray(options.allowed_origins) && options.allowed_origins.length
    ? options.allowed_origins.map(publicOrigin).filter(Boolean) : [publicOrigin(site.url)].filter(Boolean);
  if (!origins.length || !origins.includes(siteUrl.origin)) return null;
  let path = options.path || site.root || siteUrl.pathname || '/';
  if (typeof path !== 'string' || !path.startsWith('/') || path.startsWith('//') || /[?#\\]/.test(path)) return null;
  path = path.replace(/\/+$/, '') || '/';
  return { website_id: options.website_id, script_url: script.href, allowed_origins: [...new Set(origins)], path };
}

module.exports = { umamiOptions };
