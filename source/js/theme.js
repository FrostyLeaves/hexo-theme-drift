/* Drift theme — palette cycling, header state, hero typing and counters, card tilt and foil,
   TOC scroll-spy, code copy, comments. Plain browser JavaScript, no dependencies.
   The swirl backdrop lives in background.js and listens for the `drift:palette` event. */
(function () {
  'use strict';

  var KEY = 'drift-palette';
  var root = document.documentElement;
  var theme = window.__THEME || {};
  var palettes = theme.palettes || {};
  var names = Object.keys(palettes);
  var labels = theme.labels || {};
  var autoPalette = theme.auto || names[0] || '';
  var reduce = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  function reduced() { return !!(reduce && reduce.matches); }

  /* ---------------------------------------------------------------- palette */
  function storedPref() {
    var pref = null;
    try { pref = localStorage.getItem(KEY); } catch (e) { pref = null; }
    return names.indexOf(pref) >= 0 ? pref : 'auto';
  }
  function applyPref(pref) {
    var name = pref === 'auto' ? autoPalette : pref;
    root.setAttribute('data-palette', name);
    root.setAttribute('data-palette-pref', pref);
    var button = document.getElementById('palette-toggle');
    var label = document.getElementById('palette-label');
    var colour = labels[name] || name;
    // the disc shows the colours in use; the text names the mode: "auto" or the palette picked by hand
    var text = pref === 'auto' ? (labels.auto || 'auto') : colour;
    if (label) label.textContent = text;
    if (button) {
      var title = (labels.toggle || 'Palette') + ': ' + (pref === 'auto' ? text + ' · ' + colour : colour);
      button.setAttribute('title', title);
      button.setAttribute('aria-label', title);
    }
    try {
      document.dispatchEvent(new CustomEvent('drift:palette', { detail: { name: name, pref: pref } }));
    } catch (e) { /* very old browsers: the backdrop simply keeps its colours */ }
  }
  // auto -> each palette in turn -> auto, skipping any step that would leave the colours as they are
  // (on a page whose automatic palette is blue, "blue by hand" looks identical to "auto")
  function cyclePref() {
    var order = ['auto'].concat(names);
    var pref = storedPref();
    var current = pref === 'auto' ? autoPalette : pref;
    var index = order.indexOf(pref);
    var next = pref;
    for (var i = 1; i <= order.length; i++) {
      var candidate = order[(index + i) % order.length];
      if ((candidate === 'auto' ? autoPalette : candidate) !== current) { next = candidate; break; }
    }
    try { localStorage.setItem(KEY, next); } catch (e) { /* ignore */ }
    applyPref(next);
  }
  function initPalette() {
    var button = document.getElementById('palette-toggle');
    if (button) button.addEventListener('click', cyclePref);
    applyPref(storedPref());
  }

  /* ---------------------------------------------------------------- backdrop scene */
  var BG_KEY = 'drift-background';
  var bg = theme.background || {};
  var scenes = Array.isArray(bg.styles) ? bg.styles : [];
  var sceneDefault = scenes.indexOf(bg.style) >= 0 ? bg.style : scenes[0];
  var sceneLabels = labels.scenes || {};
  function storedScene() {
    var name = null;
    try { name = localStorage.getItem(BG_KEY); } catch (e) { name = null; }
    return scenes.indexOf(name) >= 0 ? name : sceneDefault;
  }
  function applyScene(name, animate) {
    root.setAttribute('data-background', name);
    var button = document.getElementById('background-toggle');
    var label = document.getElementById('background-label');
    var text = sceneLabels[name] || name;
    if (label) label.textContent = text;
    if (button) {
      var title = (labels.sceneToggle || 'Backdrop') + ': ' + text;
      button.setAttribute('title', title);
      button.setAttribute('aria-label', title);
    }
    try {
      document.dispatchEvent(new CustomEvent('drift:background', { detail: { name: name, animate: animate } }));
    } catch (e) { /* very old browsers keep the default scene */ }
  }
  function cycleScene() {
    if (!scenes.length) return;
    var next = scenes[(scenes.indexOf(storedScene()) + 1) % scenes.length];
    try { localStorage.setItem(BG_KEY, next); } catch (e) { /* ignore */ }
    applyScene(next, true);
  }
  function initScene() {
    if (!scenes.length) return;
    var button = document.getElementById('background-toggle');
    if (button) button.addEventListener('click', cycleScene);
    applyScene(storedScene(), false);
  }

  /* ---------------------------------------------------------------- day / night */
  var MODE_KEY = 'drift-mode';
  var modeDefault = bg.mode === 'day' ? 'day' : 'night';
  var modeLabels = labels.modes || {};
  var THEME_COLOR = { night: '#191a1c', day: '#f0eee8' };
  function storedMode() {
    var mode = null;
    try { mode = localStorage.getItem(MODE_KEY); } catch (e) { mode = null; }
    return mode === 'day' || mode === 'night' ? mode : modeDefault;
  }
  function applyMode(mode, animate) {
    root.setAttribute('data-mode', mode);
    var button = document.getElementById('mode-toggle');
    var label = document.getElementById('mode-label');
    var text = modeLabels[mode] || mode;
    if (label) label.textContent = text;
    if (button) {
      var title = (labels.modeToggle || 'Day / night') + ': ' + text;
      button.setAttribute('title', title);
      button.setAttribute('aria-label', title);
    }
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', THEME_COLOR[mode]);
    syncComments(mode);
    try {
      document.dispatchEvent(new CustomEvent('drift:mode', { detail: { mode: mode, animate: animate } }));
    } catch (e) { /* very old browsers keep the default */ }
  }
  function toggleMode() {
    var next = storedMode() === 'day' ? 'night' : 'day';
    try { localStorage.setItem(MODE_KEY, next); } catch (e) { /* ignore */ }
    applyMode(next, true);
  }
  function initMode() {
    var button = document.getElementById('mode-toggle');
    if (button) button.addEventListener('click', toggleMode);
    applyMode(storedMode(), false);
  }

  /* ---------------------------------------------------------------- header over hero */
  function initHeader() {
    var header = document.getElementById('site-header');
    var hero = document.querySelector('.hero');
    if (!header || !hero) return;
    var update = function () {
      var threshold = hero.offsetHeight - header.offsetHeight;
      header.classList.toggle('is-scrolled', window.scrollY > threshold);
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
  }

  /* ---------------------------------------------------------------- hero typing */
  function initTyping() {
    var el = document.querySelector('.hero__subtitle[data-typing]');
    if (!el) return;
    var text = el.getAttribute('data-typing') || el.textContent;
    el.style.visibility = '';
    if (reduced()) { el.textContent = text; return; }
    el.textContent = '';
    el.classList.add('is-typing');
    var chars = Array.from(text);
    var i = 0;
    var step = function () {
      if (i < chars.length) {
        el.textContent += chars[i++];
        setTimeout(step, chars[i - 1] === ' ' ? 40 : 70);
      } else {
        setTimeout(function () { el.classList.remove('is-typing'); }, 2200);
      }
    };
    setTimeout(step, 400);
  }

  /* ---------------------------------------------------------------- hero counters (score roll) */
  function initCounters() {
    var badges = document.querySelectorAll('.hero__stats [data-count]');
    if (!badges.length || reduced()) return;
    Array.prototype.forEach.call(badges, function (badge, index) {
      var target = parseInt(badge.getAttribute('data-count'), 10);
      var num = badge.querySelector('.badge__num');
      if (!num || !(target > 0)) return;
      var start = null, duration = 700 + index * 150, delay = 250 + index * 120, done = false;
      var finish = function () { if (!done) { done = true; num.textContent = String(target); } };
      var tick = function (now) {
        if (done) return;
        if (start === null) start = now;
        var k = Math.min(1, (now - start) / duration);
        var e = 1 - Math.pow(1 - k, 3);
        num.textContent = String(Math.round(target * e));
        if (k < 1) requestAnimationFrame(tick);
        else finish();
      };
      num.textContent = '0';
      setTimeout(function () { requestAnimationFrame(tick); }, delay);
      // whatever happens to animation frames (background tab, throttling), land on the real number
      setTimeout(finish, delay + duration + 400);
    });
  }

  /* ---------------------------------------------------------------- title lettering: pause off screen */
  function initTitles() {
    var titles = document.querySelectorAll('.title-anim');
    if (!titles.length || !('IntersectionObserver' in window)) return;
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) { entry.target.classList.toggle('is-offscreen', !entry.isIntersecting); });
    });
    Array.prototype.forEach.call(titles, function (title) { observer.observe(title); });
  }

  /* ---------------------------------------------------------------- card tilt + foil */
  function initTilt() {
    if (!document.body.classList.contains('juice-tilt') && !document.body.classList.contains('juice-foil')) return;
    if (reduced()) return;
    if (window.matchMedia && !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    var cards = document.querySelectorAll('[data-tilt]');
    Array.prototype.forEach.call(cards, function (card) {
      var rect = null;
      var reset = function () {
        card.classList.remove('is-tilting');
        card.style.setProperty('--rx', '0');
        card.style.setProperty('--ry', '0');
        rect = null;
      };
      card.addEventListener('pointerenter', function () {
        rect = card.getBoundingClientRect();
        card.classList.add('is-tilting');
      });
      card.addEventListener('pointermove', function (event) {
        if (!rect) rect = card.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        var x = (event.clientX - rect.left) / rect.width;
        var y = (event.clientY - rect.top) / rect.height;
        x = Math.max(0, Math.min(1, x));
        y = Math.max(0, Math.min(1, y));
        card.style.setProperty('--rx', ((y - 0.5) * 2).toFixed(3));
        card.style.setProperty('--ry', ((x - 0.5) * 2).toFixed(3));
        card.style.setProperty('--mx', (x * 100).toFixed(1) + '%');
        card.style.setProperty('--my', (y * 100).toFixed(1) + '%');
      });
      card.addEventListener('pointerleave', reset);
      card.addEventListener('pointercancel', reset);
    });
  }

  /* ---------------------------------------------------------------- TOC scroll-spy */
  function initToc() {
    var tocs = document.querySelectorAll('.toc');
    if (!tocs.length) return;
    var content = document.querySelector('.post-content');
    if (!content) return;
    var headings = Array.prototype.slice.call(content.querySelectorAll('h2[id], h3[id], h4[id]'));
    if (!headings.length) return;

    var links = Array.prototype.slice.call(document.querySelectorAll('.toc .toc-list-link'));
    var linksById = {};
    links.forEach(function (link) {
      var hash = link.getAttribute('href') || '';
      var id = hash.slice(hash.indexOf('#') + 1);
      try { id = decodeURIComponent(id); } catch (e) { /* keep raw */ }
      (linksById[id] = linksById[id] || []).push(link);
    });

    var headerOffset = 96;
    var current = null;
    var ticking = false;

    function pick() {
      var y = window.scrollY + headerOffset;
      var atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
      var active = null;
      if (atBottom) {
        active = headings[headings.length - 1];
      } else {
        for (var i = 0; i < headings.length; i++) {
          var top = headings[i].getBoundingClientRect().top + window.scrollY;
          if (top <= y) active = headings[i];
          else break;
        }
      }
      var id = active ? active.id : null;
      if (id === current) return;
      current = id;
      links.forEach(function (link) { link.classList.remove('is-active'); });
      if (id && linksById[id]) {
        linksById[id].forEach(function (link) {
          link.classList.add('is-active');
          var box = link.closest('.toc');
          if (box && box.scrollHeight > box.clientHeight) {
            var top = link.offsetTop - box.offsetTop;
            if (top < box.scrollTop + 24 || top > box.scrollTop + box.clientHeight - 48) {
              box.scrollTop = Math.max(0, top - box.clientHeight / 2);
            }
          }
        });
      }
    }
    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () { ticking = false; pick(); });
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    window.addEventListener('load', pick);
    pick();
  }

  /* ---------------------------------------------------------------- code copy */
  function initCodeCopy() {
    var figures = document.querySelectorAll('figure.highlight');
    if (!figures.length) return;
    var copyLabel = labels.copy || 'Copy';
    var copiedLabel = labels.copied || 'Copied';
    function fallbackCopy(text) {
      var area = document.createElement('textarea');
      area.value = text;
      area.setAttribute('readonly', '');
      area.style.position = 'fixed';
      area.style.top = '-1000px';
      document.body.appendChild(area);
      area.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      document.body.removeChild(area);
      return ok;
    }
    Array.prototype.forEach.call(figures, function (figure) {
      var pre = figure.querySelector('td.code pre') || figure.querySelector('pre');
      if (!pre) return;
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'code-copy';
      button.textContent = copyLabel;
      button.setAttribute('aria-label', copyLabel);
      button.addEventListener('click', function () {
        var text = pre.innerText.replace(/\n$/, '');
        var done = function () {
          button.textContent = copiedLabel;
          button.classList.add('is-copied');
          setTimeout(function () {
            button.textContent = copyLabel;
            button.classList.remove('is-copied');
          }, 1600);
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(done, function () { if (fallbackCopy(text)) done(); });
        } else if (fallbackCopy(text)) {
          done();
        }
      });
      figure.appendChild(button);
    });
  }

  /* ---------------------------------------------------------------- comments (Utterances) */
  function commentsTheme(mode) { return mode === 'day' ? 'github-light' : 'github-dark'; }
  function initComments() {
    var box = document.getElementById('comments');
    if (!box || !box.getAttribute('data-repo')) return;
    var script = document.createElement('script');
    script.src = 'https://utteranc.es/client.js';
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.setAttribute('repo', box.getAttribute('data-repo'));
    script.setAttribute('issue-term', box.getAttribute('data-issue-term') || 'title');
    var label = box.getAttribute('data-label');
    if (label) script.setAttribute('label', label);
    script.setAttribute('theme', commentsTheme(root.getAttribute('data-mode')));
    box.appendChild(script);
  }
  function syncComments(mode) {
    var frame = document.querySelector('.utterances-frame');
    if (!frame || !frame.contentWindow) return;
    frame.contentWindow.postMessage({ type: 'set-theme', theme: commentsTheme(mode) }, 'https://utteranc.es');
  }

  /* ---------------------------------------------------------------- boot */
  function boot() {
    initPalette();
    initScene();
    initMode();
    initHeader();
    initTyping();
    initCounters();
    initTitles();
    initTilt();
    initToc();
    initCodeCopy();
    initComments();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
