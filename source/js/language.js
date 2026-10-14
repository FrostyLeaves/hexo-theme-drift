/* Interface translations. The article's own content is supplied by its author. */
(function () {
  'use strict';
  var theme = window.__THEME || {};
  var config = theme.i18n;
  if (!config || !config.languages.length) return;
  var root = document.documentElement;
  var current = root.lang;

  function apply(language) {
    if (config.languages.indexOf(language) < 0) language = config.default;
    current = language;
    root.lang = language;
    var dictionary = config.dictionaries[language] || {};
    function text(key) { return Object.prototype.hasOwnProperty.call(dictionary, key) ? dictionary[key] : key; }
    ['aria-label', 'title'].forEach(function (attribute) {
      Array.prototype.forEach.call(document.querySelectorAll('[data-i18n-' + attribute + ']'), function (el) {
        el.setAttribute(attribute, text(el.getAttribute('data-i18n-' + attribute)));
      });
    });
    Array.prototype.forEach.call(document.querySelectorAll('[data-i18n]'), function (el) {
      el.textContent = text(el.getAttribute('data-i18n'));
    });
    var title = document.querySelector('title[data-i18n-document-title]');
    if (title) document.title = text(title.getAttribute('data-i18n-document-title')) + ' · ' + title.getAttribute('data-site-title');
    var button = document.getElementById('language-toggle');
    if (button) {
      var label = text('language.toggle') + ': ' + text('language.name');
      button.setAttribute('title', label);
      button.setAttribute('aria-label', label);
    }
    var labels = {
      auto: text('palette.auto'), toggle: text('palette.toggle'), copy: text('post.copy'), copied: text('post.copied'),
      sceneToggle: text('background.toggle'), scenes: {}, modeToggle: text('mode.toggle'),
      modes: { auto: text('mode.auto'), day: text('mode.day'), night: text('mode.night') }
    };
    Object.keys(theme.palettes || {}).forEach(function (name) {
      var entry = theme.palettes[name];
      labels[name] = entry.label || dictionary['palette.' + name] || name;
    });
    ((theme.background || {}).styles || []).forEach(function (name) {
      labels.scenes[name] = dictionary['background.' + name] || name;
    });
    theme.labels = labels;
    document.dispatchEvent(new CustomEvent('drift:language', { detail: { language: language } }));
  }

  var button = document.getElementById('language-toggle');
  if (button) button.addEventListener('click', function () {
    var next = config.languages[(config.languages.indexOf(current) + 1) % config.languages.length];
    try { localStorage.setItem('drift-language', next); } catch (e) { /* keep the choice for this page */ }
    apply(next);
  });
  apply(current);
})();
