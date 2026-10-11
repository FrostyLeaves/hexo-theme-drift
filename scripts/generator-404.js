'use strict';

// GitHub Pages and most static hosts serve /404.html for unknown paths.
hexo.extend.generator.register('theme-404', function () {
  return {
    path: '404.html',
    layout: ['404'],
    data: { title: '404', comments: false }
  };
});
