/* Article reading ruler. No dependencies; the geometry is also used by the Node tests. */
(function (factory) {
  'use strict';
  var reading = factory();
  if (typeof module === 'object' && module.exports) module.exports = reading;
  else if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', reading.init);
  else reading.init();
})(function () {
  'use strict';

  function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }

  // Complete when the final line of the body is visible. Comments and the footer do not count.
  function measure(input) {
    var maxScroll = Math.max(0, input.documentHeight - input.viewportHeight);
    var start = clamp(input.top - input.headerHeight - 32, 0, maxScroll);
    var end = Math.max(start, Math.min(maxScroll, input.bottom - input.viewportHeight + 32));
    var progress = end > start ? clamp((input.scrollY - start) / (end - start), 0, 1)
      : (input.bottom <= input.scrollY + input.viewportHeight - 32 ? 1 : 0);
    return { start: start, end: end, progress: progress };
  }

  // Keep nearby headings readable; long outlines use a scrollable list instead of overlapping.
  function arrange(positions, height, active) {
    var sizes = positions.map(function (_, i) { return i === active ? 88 : 40; });
    var total = sizes.reduce(function (sum, size) { return sum + size; }, 0);
    var tops = [], bottom = 0;
    positions.forEach(function (position, i) {
      tops[i] = total > height ? bottom : Math.max(bottom, position - sizes[i] / 2);
      bottom = tops[i] + sizes[i];
    });
    if (total <= height) {
      bottom = height;
      for (var i = tops.length - 1; i >= 0; i--) {
        tops[i] = Math.min(tops[i], bottom - sizes[i]);
        bottom = tops[i];
      }
    }
    return { tops: tops, sizes: sizes, overflow: total > height, height: Math.max(total, height) };
  }

  function activeHeading(tops, readingLine, complete) {
    if (complete) return tops.length - 1;
    var active = -1;
    tops.forEach(function (top, i) { if (top <= readingLine + 2) active = i; });
    return active;
  }

  function init() {
    var rail = document.querySelector('.reading-rail');
    var content = document.querySelector('.post-content');
    if (!rail || !content) return;
    var header = document.getElementById('site-header');
    var stage = rail.querySelector('.reading-rail__stage');
    var chapters = rail.querySelector('.reading-rail__chapters');
    var ruler = rail.querySelector('.reading-rail__ruler');
    var ticks = rail.querySelector('.reading-rail__ticks');
    var cursor = rail.querySelector('.reading-rail__cursor');
    var mobile = document.querySelector('.reading-mobile');
    var counters = document.querySelectorAll('[data-reading-percent]');
    var desktop = window.matchMedia('(min-width: 1120px)');
    var entries = [], byId = new Map();
    var list = document.createElement('ol');
    list.className = 'reading-rail__list';

    Array.prototype.forEach.call(chapters.querySelectorAll('.toc-list-link'), function (link) {
      var id = link.hash.slice(1);
      try { id = decodeURIComponent(id); } catch (_) { /* retain malformed IDs literally */ }
      var heading = document.getElementById(id);
      if (!heading || !content.contains(heading) || byId.has(id)) return;
      var title = link.textContent.trim();
      var item = document.createElement('li');
      item.className = 'reading-rail__item';
      item.setAttribute('data-depth', heading.tagName.slice(1));
      link.className = 'reading-rail__link';
      link.setAttribute('aria-label', title);
      link.setAttribute('title', title);
      link.replaceChildren();
      var number = document.createElement('span');
      number.className = 'reading-rail__number';
      number.setAttribute('aria-hidden', 'true');
      number.textContent = String(entries.length + 1).padStart(2, '0');
      var label = document.createElement('span');
      label.className = 'reading-rail__label';
      label.setAttribute('aria-hidden', 'true');
      var chars = Array.from(title);
      if (chars.length > 48) chars = chars.slice(0, 47).concat('…');
      chars.forEach(function (char, i) {
        var span = document.createElement('span');
        span.className = 'rail-ch';
        span.style.setProperty('--i', i);
        span.textContent = char === ' ' ? '\u00a0' : char;
        label.appendChild(span);
      });
      link.append(number, label);
      item.appendChild(link);
      list.appendChild(item);
      var entry = { id: id, heading: heading, item: item, link: link, links: [link] };
      entries.push(entry);
      byId.set(id, entry);
    });
    chapters.replaceChildren(list);
    // Only rendered TOC entries participate. A skipped heading depth cannot clear the active item.
    Array.prototype.forEach.call(document.querySelectorAll('.toc-mobile .toc-list-link'), function (link) {
      var id = link.hash.slice(1);
      try { id = decodeURIComponent(id); } catch (_) { /* use raw fragment */ }
      if (byId.has(id)) byId.get(id).links.push(link);
    });

    var top = 0, bottom = 0, headingTops = [], headerHeight = 0;
    var dirty = true, pending = false, dragging = false;
    var current = -2, percent = -1, layout;
    var state = { start: 0, end: 0, progress: 0 };
    rail.classList.add('is-ready');
    if (mobile) mobile.hidden = false;

    function update() {
      pending = false;
      var geometryChanged = dirty;
      if (dirty) {
        var rect = content.getBoundingClientRect();
        top = rect.top + window.scrollY;
        bottom = rect.bottom + window.scrollY;
        headerHeight = header ? header.offsetHeight : 0;
        headingTops = entries.map(function (entry) { return entry.heading.getBoundingClientRect().top + window.scrollY; });
        dirty = false;
      }
      state = measure({ top: top, bottom: bottom, headerHeight: headerHeight, scrollY: window.scrollY,
        viewportHeight: window.innerHeight, documentHeight: document.documentElement.scrollHeight });
      var next = activeHeading(headingTops, window.scrollY + headerHeight + 32, state.progress === 1);
      var changed = next !== current;
      if (changed) {
        current = next;
        entries.forEach(function (entry, i) {
          entry.links.forEach(function (link) {
            link.classList.toggle('is-active', i === current);
            if (i === current) link.setAttribute('aria-current', 'location');
            else link.removeAttribute('aria-current');
          });
          entry.item.classList.toggle('is-past', i < current);
        });
      }
      var value = Math.round(state.progress * 100);
      if (value !== percent) {
        percent = value;
        Array.prototype.forEach.call(counters, function (counter) { counter.textContent = String(value).padStart(3, '0') + '%'; });
        ruler.setAttribute('aria-valuenow', value);
        if (mobile) mobile.setAttribute('aria-valuenow', value);
      }
      if (mobile) mobile.style.setProperty('--reading-progress', state.progress);
      rail.inert = !desktop.matches;
      if (!desktop.matches) return;
      var height = stage.clientHeight;
      // Keep one stable full-article scale. Hovering must not relocate the user's targets.
      ticks.style.height = height + 'px';
      cursor.style.transform = 'translateY(' + Math.round(state.progress * height) + 'px)';
      var positions = headingTops.map(function (headingTop) {
        var fraction = state.end > state.start ? clamp((headingTop - headerHeight - 32 - state.start) / (state.end - state.start), 0, 1) : 0;
        return fraction * height;
      });
      layout = arrange(positions, height, current);
      chapters.classList.toggle('is-overflowing', layout.overflow);
      list.style.height = layout.height + 'px';
      entries.forEach(function (entry, i) {
        entry.item.style.transform = 'translateY(' + Math.round(layout.tops[i]) + 'px)';
        entry.item.style.height = layout.sizes[i] + 'px';
      });
      if ((changed || geometryChanged) && layout.overflow && current >= 0 && !chapters.contains(document.activeElement)) {
        chapters.scrollTop = Math.max(0, layout.tops[current] - height / 2);
      }
    }

    function schedule() { if (!pending) { pending = true; requestAnimationFrame(update); } }
    function resize() { dirty = true; schedule(); }
    function seek(fraction) {
      window.scrollTo({ top: state.start + clamp(fraction, 0, 1) * (state.end - state.start),
        behavior: 'instant' });
    }
    function pointerSeek(event) {
      var rect = ruler.getBoundingClientRect();
      seek((event.clientY - rect.top) / rect.height);
    }
    ruler.addEventListener('pointerdown', function (event) {
      if (event.button !== 0) return;
      event.preventDefault();
      dragging = true;
      // Pointer seeking should not leave a previously keyboard-focused ruler highlighted.
      if (rail.contains(document.activeElement)) document.activeElement.blur();
      ruler.setPointerCapture(event.pointerId);
      pointerSeek(event);
      schedule();
    });
    ruler.addEventListener('pointermove', function (event) { if (dragging) pointerSeek(event); });
    function endDrag() { dragging = false; schedule(); }
    ruler.addEventListener('pointerup', endDrag);
    ruler.addEventListener('pointercancel', endDrag);
    ruler.addEventListener('lostpointercapture', endDrag);
    ruler.addEventListener('keydown', function (event) {
      var keys = { ArrowDown: 0.01, ArrowRight: 0.01, ArrowUp: -0.01, ArrowLeft: -0.01,
        PageDown: 0.1, PageUp: -0.1, Home: -1, End: 1 };
      if (!Object.prototype.hasOwnProperty.call(keys, event.key)) return;
      event.preventDefault();
      seek(event.key === 'Home' ? 0 : event.key === 'End' ? 1 : state.progress + keys[event.key]);
    });
    // Keyboard focus must remain visible even in very long outlines.
    chapters.addEventListener('focusin', function (event) {
      var index = entries.findIndex(function (entry) { return entry.link === event.target; });
      if (layout && layout.overflow && index >= 0) {
        var y = layout.tops[index];
        if (y < chapters.scrollTop || y + layout.sizes[index] > chapters.scrollTop + chapters.clientHeight) chapters.scrollTop = Math.max(0, y - 32);
      }
    });
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', resize);
    window.addEventListener('load', resize);
    document.addEventListener('drift:language', resize);
    if (typeof ResizeObserver !== 'undefined') {
      var observer = new ResizeObserver(resize);
      observer.observe(content);
      if (header) observer.observe(header);
      var details = document.querySelector('.toc-mobile');
      if (details) observer.observe(details);
    }
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(resize);
    update();
  }
  return { measure: measure, arrange: arrange, activeHeading: activeHeading, init: init };
});
