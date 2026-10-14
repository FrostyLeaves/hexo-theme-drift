'use strict';

const { escapeHTML } = require('hexo-util');
const { languageOptions } = require('../lib/theme-options');

function setup(context) {
  const i18n = hexo.theme.i18n;
  const settings = languageOptions(context.theme.i18n, context.config.language, i18n.list());
  const dictionaries = {};
  settings.languages.forEach(lang => {
    dictionaries[lang] = i18n.get([lang, 'default']);
  });
  return { ...settings, dictionaries };
}

hexo.extend.helper.register('language_setup', function () { return setup(this); });

// Render all interface translations so the saved language is visible before theme.js boots.
hexo.extend.helper.register('ui_text', function (key, lettering) {
  const settings = setup(this);
  return settings.languages.map(lang => {
    const text = settings.dictionaries[lang][key] ?? key;
    const content = lettering ? this.letter_spans(text, lettering) : escapeHTML(String(text));
    return `<span data-ui-lang="${escapeHTML(lang)}">${content}</span>`;
  }).join('');
});

hexo.extend.helper.register('ui_label', function (key) {
  const settings = setup(this);
  return settings.dictionaries[settings.default][key] ?? key;
});

hexo.extend.helper.register('theme_json', function (value) {
  return JSON.stringify(value).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
});
