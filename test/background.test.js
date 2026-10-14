'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');

const source = readFileSync(join(__dirname, '../source/js/background.js'), 'utf8');

function backdrop(reduced) {
  const window = new EventTarget();
  const document = new EventTarget();
  const media = new EventTarget();
  media.matches = reduced;
  Object.assign(window, { innerWidth: 1440, innerHeight: 900, matchMedia: () => media,
    __THEME: { background: { fps: 10 }, palettes: { jade: { colors: ['#4bc292', '#264c44', '#182a26'] } } } });
  document.documentElement = { getAttribute: key => ({ 'data-background': 'sky', 'data-mode': 'night', 'data-palette': 'jade' }[key]) };
  let width = 300, height = 150, blank = true, resolution, viewport, time;
  const frames = [];
  const gl = {};
  ['createShader', 'createProgram', 'createBuffer', 'getAttribLocation'].forEach(key => { gl[key] = () => ({}); });
  ['shaderSource', 'compileShader', 'deleteShader', 'attachShader', 'linkProgram', 'useProgram',
    'bindBuffer', 'enableVertexAttribArray', 'vertexAttribPointer', 'bufferData', 'uniform3fv'].forEach(key => { gl[key] = () => {}; });
  gl.getShaderParameter = gl.getProgramParameter = () => true;
  gl.getUniformLocation = (_, name) => name;
  gl.viewport = (_, __, w, h) => { viewport = [w, h]; };
  gl.uniform2f = (_, w, h) => { resolution = [w, h]; };
  gl.uniform1f = (_, value) => { time = value; };
  gl.drawArrays = () => { blank = false; frames.push({ resolution, viewport, time }); };
  const canvas = new EventTarget();
  Object.defineProperties(canvas, {
    width: { get: () => width, set: value => { width = value; blank = true; } },
    height: { get: () => height, set: value => { height = value; blank = true; } }
  });
  canvas.getContext = () => gl;
  document.getElementById = id => ({ backdrop: { classList: { add() {} } }, 'backdrop-canvas': canvas }[id]);
  vm.runInNewContext(source, { window, document, performance: { now: () => 0 },
    sessionStorage: { getItem: () => '12.5', setItem() {} },
    requestAnimationFrame: () => 1, cancelAnimationFrame() {}, setTimeout, clearTimeout });
  return { window, canvas, frames, isBlank: () => blank };
}

for (const reduced of [false, true]) {
  test(`resize fills the cleared canvas before the next animation frame (reduced motion: ${reduced})`, () => {
    const page = backdrop(reduced);
    const initialSize = [page.canvas.width, page.canvas.height];
    const initialFrames = page.frames.length;
    page.window.innerWidth = 960;
    page.window.innerHeight = 800;
    page.window.dispatchEvent(new Event('resize'));
    const size = [page.canvas.width, page.canvas.height];
    assert.notDeepEqual(size, initialSize);
    assert.equal(page.isBlank(), false);
    assert.equal(page.frames.length, initialFrames + 1);
    assert.deepEqual(page.frames.at(-1), { resolution: size, viewport: size, time: 12.5 });
  });
}
