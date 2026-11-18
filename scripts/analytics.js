'use strict';
const { umamiOptions } = require('../lib/analytics');
hexo.extend.helper.register('umami_setup', function () {
  return umamiOptions(this.theme, this.config);
});
