'use strict';

/**
 * Post-render touch-ups that are cheaper to do once at build time than in the browser:
 *  - wrap wide tables so they scroll horizontally on narrow screens
 *  - lazy-load images below the fold
 *  - expose the code block language as data-lang for the CSS label
 */
hexo.extend.filter.register('after_post_render', function (data) {
  let html = data.content;
  if (!html) return data;

  // Keep highlight figures out of the table/image passes.
  const figures = [];
  html = html.replace(/<figure class="highlight[\s\S]*?<\/figure>/g, function (block) {
    figures.push(block);
    return '\u0000FIG' + (figures.length - 1) + '\u0000';
  });

  html = html.replace(/<table\b[\s\S]*?<\/table>/g, function (table) {
    return '<div class="table-wrap">' + table + '</div>';
  });

  html = html.replace(/<img\b(?![^>]*\bloading=)([^>]*)>/g, '<img loading="lazy" decoding="async"$1>');

  html = html.replace(/\u0000FIG(\d+)\u0000/g, function (_, index) {
    return figures[index].replace(/^<figure class="highlight(?: ([\w+#-]+))?"/, function (match, lang) {
      if (!lang || lang === 'plaintext' || lang === 'plain') return match;
      return '<figure class="highlight ' + lang + '" data-lang="' + lang + '"';
    });
  });

  data.content = html;
  return data;
});
