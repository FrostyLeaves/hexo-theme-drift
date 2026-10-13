'use strict';

function cardEffect(value) {
  if (value === false || value === 'none') return 'none';
  return ['foil', 'holographic', 'polychrome', 'negative', 'glass', 'pixel-glass'].includes(value) ? value : 'holographic';
}

function languageOptions(options = {}, siteLanguage, available = []) {
  const known = [...new Set(['en', ...available.filter(name => name !== 'default')])];
  function resolve(value, choices) {
    const name = String(value || '').toLowerCase();
    return choices.find(code => code.toLowerCase() === name) ||
      choices.find(code => code.toLowerCase().split('-')[0] === name.split('-')[0]);
  }
  const requested = Array.isArray(options.languages) ? options.languages : ['zh-CN', 'en'];
  let languages = [...new Set(requested.map(code => resolve(code, known)).filter(Boolean))]
    .filter(code => /^[a-zA-Z]{2,3}(?:-[a-zA-Z0-9]{2,8})*$/.test(code));
  if (!languages.length) languages = ['en'];
  const siteDefault = Array.isArray(siteLanguage) ? siteLanguage[0] : siteLanguage;
  const defaultLanguage = resolve(options.default || siteDefault, languages) || languages[0];
  if (options.enable === false) languages = [defaultLanguage];
  return { languages, default: defaultLanguage };
}

module.exports = { cardEffect, languageOptions };
