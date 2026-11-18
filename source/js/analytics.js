/* Optional Umami integration. No tracker request outside the configured site. */
(function () {
  'use strict';
  var element = document.getElementById('drift-umami-config');
  if (!element || window.__driftUmami || window.umami) return;
  var config;
  try { config = JSON.parse(element.textContent); } catch (_) { return; }
  var location = window.location;
  var path = config.path;
  function allowed() {
    return location.protocol === 'https:' && config.allowed_origins.indexOf(location.origin) !== -1 &&
      (path === '/' || location.pathname === path || location.pathname.indexOf(path + '/') === 0);
  }
  if (!allowed()) return;
  window.__driftUmami = true;
  var script = document.createElement('script');
  script.async = true;
  script.src = config.script_url;
  script.referrerPolicy = 'no-referrer';
  script.setAttribute('data-website-id', config.website_id);
  // Manual-only mode is supported by Umami v2 and v3. No automatic clicks or
  // pageviews: this static theme explicitly sends one sanitised pageview below.
  script.setAttribute('data-auto-track', 'false');
  script.onload = function () {
    if (!allowed() || !window.umami || typeof window.umami.track !== 'function') return;
    var referrer = '';
    try { referrer = new URL(document.referrer).origin; } catch (_) { /* direct visit */ }
    try {
      var result = window.umami.track({
        website: config.website_id,
        hostname: location.hostname,
        url: location.pathname,
        title: document.title,
        language: navigator.language,
        screen: window.screen.width + 'x' + window.screen.height,
        referrer: referrer
      });
      if (result && typeof result.catch === 'function') result.catch(function () {});
    } catch (_) { /* Analytics must never interfere with reading. */ }
  };
  document.head.appendChild(script);
})();
