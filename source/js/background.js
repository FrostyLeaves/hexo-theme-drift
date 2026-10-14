/* Drift theme — the pixel backdrop.
   Two scenes, each with a night and a day version, drawn by WebGL 1 fragment shaders at a low
   internal resolution and upscaled with image-rendering: pixelated:
     sky    night = a starry sky with drifting parallax stars, a faint nebula and the odd meteor
            day   = a sea of clouds under a hazy sky
     ocean  night = a moonlit sea with a glitter lane
            day   = a calm sea under diffuse daylight with wind sparkle
   Nature keeps its own colours; the palette only colours the light (haze, glow, cloud shade,
   lit water), so switching palettes reads as the same place under different light. The scene
   button and the day/night button dissolve between shaders through a snapshot of the last frame;
   palette changes interpolate the tint. Everything is slow on purpose and scaled by
   `background.speed`. Pauses when the tab is hidden, draws one still frame under
   prefers-reduced-motion, keeps its clock across pages, and leaves the CSS gradient in place when
   WebGL is unavailable. No dependencies. */
(function () {
  'use strict';

  var holder = document.getElementById('backdrop');
  var canvas = document.getElementById('backdrop-canvas');
  var snapshot = document.getElementById('backdrop-snapshot');
  if (!holder || !canvas) return;
  var TIME_KEY = 'drift-bg-time';

  var theme = window.__THEME || {};
  var cfg = theme.background || {};
  var palettes = theme.palettes || {};
  var root = document.documentElement;
  var reduce = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;

  var VERT = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.0,1.0);}';

  var PRELUDE = [
    '#ifdef GL_FRAGMENT_PRECISION_HIGH',
    'precision highp float;',
    '#else',
    'precision mediump float;',
    '#endif',
    'uniform vec2 u_res;',
    'uniform float u_time;',
    'uniform vec3 u_c1;',   // palette: light tint
    'uniform vec3 u_c2;',   // palette: second tint
    'uniform vec3 u_c3;',   // palette: dark base
    'float hash21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }',
    'float vnoise(vec2 p) {',
    '  vec2 i = floor(p), f = fract(p);',
    '  f = f * f * (3.0 - 2.0 * f);',
    '  float a = hash21(i), b = hash21(i + vec2(1.0, 0.0)), c = hash21(i + vec2(0.0, 1.0)), d = hash21(i + vec2(1.0, 1.0));',
    '  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);',
    '}',
    'float fbm(vec2 p) {',
    '  float v = 0.0, a = 0.5;',
    '  for (int i = 0; i < 5; i++) { v += a * vnoise(p); p = p * 2.03 + vec2(17.1, 9.7); a *= 0.5; }',
    '  return v;',
    '}',
    'float band(float v, float n) { return floor(v * n + 0.0001) / n; }',
    // Pixel stars on a slowly drifting grid; px is the shader pixel coordinate.
    'vec3 stars(vec2 px, float cell, float density, float size, float drift, float t, vec3 tint, float cross) {',
    '  vec2 q = (px + vec2(t * drift, 0.0)) / cell;',
    '  vec2 id = floor(q);',
    '  vec2 f = fract(q);',
    '  float h = hash21(id);',
    '  if (h < 1.0 - density) return vec3(0.0);',
    '  vec2 c = vec2(hash21(id + 7.3), hash21(id + 11.9)) * 0.6 + 0.2;',
    '  vec2 d = abs(f - c) * cell;',
    '  float core = step(d.x, size) * step(d.y, size);',
    '  float arm = cross * (step(d.x, size * 0.5) * step(d.y, size * 2.6) + step(d.y, size * 0.5) * step(d.x, size * 2.6));',
    '  float tw = 0.55 + 0.45 * sin(t * (0.6 + 1.6 * hash21(id + 3.1)) + h * 6.2831);',
    '  float b = clamp(core + arm * 0.7, 0.0, 1.0) * tw;',
    '  return b * mix(vec3(1.0), tint, 0.4 * step(0.7, hash21(id + 5.5)));',
    '}',
    // The same wave field for both ocean versions: lvl is a posterised height, 0..0.75 in steps of 0.25.
    'float seaLevel(vec2 p, vec2 px, float d, float t) {',
    '  float z = 1.0 / (0.05 + d * 1.6);',
    '  float x = p.x * z * 0.9;',
    '  float wave = sin(x * 1.3 + z * 0.9 + t * 0.30) * 0.5',
    '             + sin(x * 2.7 - z * 1.7 - t * 0.42) * 0.3',
    '             + sin(z * 2.2 - t * 0.36 + x * 0.4) * 0.45;',
    '  wave += (fbm(vec2(x * 0.8, z * 0.8) + vec2(t * 0.04, -t * 0.06)) - 0.5) * 1.1;',
    '  wave += (vnoise(vec2(x * 6.0 + t * 0.25, z * 4.0 - t * 0.2)) - 0.5) * 0.45;',
    '  return band(clamp(0.5 + wave * 0.26, 0.0, 0.999), 4.0);',
    '}'
  ].join('\n');

  var SKY_NIGHT = [
    'vec3 meteor(vec2 p, float t) {',
    '  float period = 24.0;',
    '  float k = floor(t / period);',
    '  float lt = t - k * period;',
    '  float start = 3.0 + hash21(vec2(k, 1.0)) * 14.0;',
    '  float u = (lt - start) / 1.1;',
    '  if (u < 0.0 || u > 1.0) return vec3(0.0);',
    '  vec2 a = vec2(hash21(vec2(k, 2.0)) * 1.4 - 0.9, 0.05 + hash21(vec2(k, 3.0)) * 0.4);',
    '  vec2 dir = normalize(vec2(0.75 + hash21(vec2(k, 4.0)) * 0.5, -0.42));',
    '  vec2 head = a + dir * (u * 0.6);',
    '  float tail = 0.16;',
    '  vec2 pa = p - (head - dir * tail);',
    '  float h = clamp(dot(pa, dir) / tail, 0.0, 1.0);',
    '  float d = length(pa - dir * tail * h);',
    '  float line = smoothstep(0.0045, 0.0, d) * h * h;',
    '  return vec3(1.0) * line * sin(u * 3.14159);',
    '}',
    'void main() {',
    '  vec2 px = gl_FragCoord.xy;',
    '  vec2 p = (px - 0.5 * u_res) / u_res.y;',
    '  float yy = px.y / u_res.y;',
    '  float t = u_time;',
    '  vec3 tint = u_c1;',
    '  vec3 deep = u_c3 * 0.72;',
    '  vec3 low = mix(u_c3 * 1.25, tint, 0.22);',
    '  vec3 sky = mix(low, deep, smoothstep(0.0, 0.9, yy));',
    '  vec2 q = p * 1.5 + vec2(t * 0.004, -t * 0.0025);',
    '  float n = fbm(q + 0.5 * fbm(q * 1.7 + t * 0.003));',
    '  float n2 = fbm(p * 2.2 - vec2(t * 0.003, t * 0.004) + 9.0);',
    '  vec3 nebA = mix(vec3(0.16, 0.20, 0.34), tint, 0.55);',
    '  vec3 nebB = mix(vec3(0.30, 0.22, 0.40), u_c2, 0.45);',
    '  vec3 neb = mix(nebB, nebA, smoothstep(0.35, 0.75, n2));',
    '  float na = band(smoothstep(0.44, 0.80, n) * 0.7, 6.0);',
    '  vec3 col = mix(sky, neb, na);',
    '  col += stars(px, 4.0, 0.02, 0.5, 0.25, t, tint, 0.0) * 0.75;',
    '  col += stars(px + 31.7, 8.0, 0.05, 0.5, 0.55, t * 1.1 + 5.0, tint, 0.0) * 0.9;',
    '  col += stars(px + 77.3, 16.0, 0.07, 1.0, 0.9, t * 0.9 + 11.0, u_c2, 1.0);',
    '  col += meteor(p, t);',
    '  gl_FragColor = vec4(col, 1.0);',
    '}'
  ].join('\n');

  var SKY_DAY = [
    'float level(vec2 q, vec2 w, float lift) {',
    '  float n = fbm(q + 0.55 * (w - 0.5));',
    '  float detail = fbm(q * 3.5 + w * 2.0);',
    '  n = n * 0.8 + detail * 0.25 + lift;',
    '  return band(smoothstep(0.42, 0.88, n), 4.0);',
    '}',
    'void main() {',
    '  vec2 px = gl_FragCoord.xy;',
    '  vec2 p = px / u_res.y;',
    '  float yy = px.y / u_res.y;',
    '  float t = u_time;',
    '  vec3 tint = u_c1;',
    '  vec3 skyTop = mix(vec3(0.47, 0.66, 0.80), tint, 0.30);',
    '  vec3 skyLow = mix(vec3(0.80, 0.86, 0.90), tint, 0.32);',
    '  vec3 sky = mix(skyLow, skyTop, smoothstep(0.0, 1.0, yy));',
    '  vec2 q = vec2(p.x * 1.2, p.y * 2.6) + vec2(t * 0.012, 0.0);',
    '  vec2 w = vec2(fbm(q * 0.9 + 3.1 - t * 0.004), fbm(q * 0.9 + 7.7 + t * 0.003));',
    '  float lvl = level(q, w, 0.2 * (1.0 - yy));',
    '  float lvlUp = level(q + vec2(0.0, 2.6 / u_res.y), w, 0.2 * (1.0 - yy - 1.0 / u_res.y));',
    '  vec3 shade = mix(vec3(0.62, 0.72, 0.80), tint, 0.30);',
    '  vec3 mid = mix(vec3(0.80, 0.86, 0.90), tint, 0.18);',
    '  vec3 lit = mix(vec3(0.95, 0.96, 0.97), tint, 0.06);',
    '  vec3 col = mix(mix(sky, shade, step(0.2, lvl)), mix(mid, lit, step(0.7, lvl)), step(0.45, lvl));',
    '  float rim = step(lvlUp + 0.1, lvl);',
    '  col = mix(col, vec3(1.0), rim * 0.5);',
    '  gl_FragColor = vec4(col, 1.0);',
    '}'
  ].join('\n');

  var OCEAN_NIGHT = [
    'void main() {',
    '  vec2 px = gl_FragCoord.xy;',
    '  vec2 uv = px / u_res;',
    '  vec2 p = (px - 0.5 * u_res) / u_res.y;',
    '  float t = u_time;',
    '  float horizon = 0.6;',
    '  vec3 tint = u_c1;',
    '  vec3 col;',
    '  vec2 moonAt = vec2(0.46, 0.26);',
    '  vec3 haze = mix(u_c3 * 1.5, tint, 0.28);',
    '  if (uv.y >= horizon) {',
    '    float yy = (uv.y - horizon) / (1.0 - horizon);',
    '    col = mix(mix(u_c3 * 1.3, tint, 0.18), u_c3 * 0.7, smoothstep(0.0, 1.0, yy));',
    '    col += stars(px, 6.0, 0.03, 0.5, 0.2, t, tint, 0.0) * 0.8;',
    '    col += stars(px + 50.0, 14.0, 0.05, 1.0, 0.45, t + 3.0, u_c2, 1.0) * 0.9;',
    '    float moon = step(length(p - moonAt), 0.06);',
    '    float bite = step(length(p - moonAt - vec2(0.028, 0.012)), 0.055);',
    '    col = mix(col, mix(vec3(1.0), tint, 0.12), moon * (1.0 - bite));',
    '    col += mix(vec3(0.5), tint, 0.6) * 0.22 * smoothstep(0.22, 0.0, length(p - moonAt));',
    '    col = mix(col, haze, smoothstep(0.12, 0.0, yy) * 0.6);',
    '  } else {',
    '    float d = (horizon - uv.y) / horizon;',
    '    float lvl = seaLevel(p, px, d, t);',
    '    vec3 deep = vec3(0.04, 0.09, 0.14);',
    '    vec3 mid = vec3(0.08, 0.16, 0.24);',
    '    vec3 light = mix(vec3(0.14, 0.27, 0.38), tint, 0.22);',
    '    vec3 crest = mix(vec3(0.26, 0.42, 0.52), tint, 0.36);',
    '    vec3 water = mix(deep, mid, step(0.2, lvl));',
    '    water = mix(water, light, step(0.45, lvl));',
    '    water = mix(water, crest, step(0.7, lvl));',
    '    float lane = exp(-pow((p.x - moonAt.x * (1.0 - d * 0.55)) / (0.04 + d * 0.18), 2.0) * 2.0);',
    '    float sp = step(0.94, hash21(floor(vec2(px.x, px.y) / 2.0) + floor(t * 1.2) * 0.37));',
    '    water += mix(vec3(1.0), tint, 0.25) * lane * sp * step(0.49, lvl) * 0.9;',
    '    water = mix(water, haze, smoothstep(0.07, 0.0, d) * 0.7);',
    '    col = water;',
    '  }',
    '  gl_FragColor = vec4(col, 1.0);',
    '}'
  ].join('\n');

  var OCEAN_DAY = [
    'void main() {',
    '  vec2 px = gl_FragCoord.xy;',
    '  vec2 uv = px / u_res;',
    '  vec2 p = (px - 0.5 * u_res) / u_res.y;',
    '  float t = u_time;',
    '  float horizon = 0.58;',
    '  vec3 tint = u_c1;',
    '  vec3 skyTop = mix(vec3(0.47, 0.66, 0.80), tint, 0.30);',
    '  vec3 skyLow = mix(vec3(0.80, 0.86, 0.90), tint, 0.32);',
    '  vec3 cloudLit = mix(vec3(0.90, 0.93, 0.95), tint, 0.08);',
    '  vec3 cloudShade = mix(vec3(0.70, 0.78, 0.84), tint, 0.30);',
    '  vec3 col;',
    '  if (uv.y >= horizon) {',
    '    float yy = (uv.y - horizon) / (1.0 - horizon);',
    '    col = mix(skyLow, skyTop, smoothstep(0.0, 1.0, yy));',
    '    vec2 q = vec2(p.x * 1.3 + t * 0.01, p.y * 2.8);',
    '    float n = fbm(q) * 0.75 + fbm(q * 3.0 + 5.0) * 0.3;',
    '    float lvl = band(smoothstep(0.50, 0.80, n), 3.0);',
    '    col = mix(col, cloudShade, step(0.3, lvl));',
    '    col = mix(col, cloudLit, step(0.6, lvl));',
    '    col = mix(col, skyLow, smoothstep(0.12, 0.0, yy) * 0.6);',
    '  } else {',
    '    float d = (horizon - uv.y) / horizon;',
    '    float lvl = seaLevel(p, px, d, t);',
    '    vec3 deep = vec3(0.17, 0.40, 0.52);',
    '    vec3 mid = mix(vec3(0.24, 0.53, 0.66), tint, 0.12);',
    '    vec3 light = mix(vec3(0.42, 0.67, 0.77), tint, 0.26);',
    '    vec3 foam = mix(vec3(0.82, 0.89, 0.92), tint, 0.18);',
    '    vec3 water = mix(deep, mid, step(0.2, lvl));',
    '    water = mix(water, light, step(0.45, lvl));',
    '    water = mix(water, foam, step(0.7, lvl) * 0.6);',
    '    float sp = step(0.995, hash21(floor(vec2(px.x, px.y) / 2.0) + floor(t * 0.8) * 0.37));',
    '    water += mix(vec3(0.9), tint, 0.3) * sp * step(0.49, lvl) * (0.25 + 0.5 * d);',
    '    water = mix(water, skyLow, smoothstep(0.1, 0.0, d) * 0.75);',
    '    col = water;',
    '  }',
    '  gl_FragColor = vec4(col, 1.0);',
    '}'
  ].join('\n');

  var SCENES = {
    sky: { night: PRELUDE + '\n' + SKY_NIGHT, day: PRELUDE + '\n' + SKY_DAY },
    ocean: { night: PRELUDE + '\n' + OCEAN_NIGHT, day: PRELUDE + '\n' + OCEAN_DAY }
  };
  var SCENE_NAMES = Object.keys(SCENES);

  var gl = null, buffer = null, programs = {}, current = null, currentScene = '', currentMode = '';
  var running = false, frameHandle = 0, last = 0;
  var fps = Math.max(1, Number(cfg.fps) || 30);
  var interval = 1000 / fps;
  var speed = Number(cfg.speed);
  if (!(speed > 0)) speed = 1;
  var pixelFilter = Number(cfg.pixel_filter) || 740;
  // The scene clock carries over from the previous page of this tab, so navigating does not
  // reshuffle the stars; a fresh tab starts at a random moment.
  var time = NaN;
  try { time = parseFloat(sessionStorage.getItem(TIME_KEY)); } catch (e) { time = NaN; }
  if (!(time >= 0)) time = Math.random() * 1000;
  var snapshotTimer = 0;
  var colors = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  var from = null, to = null, mixStart = 0, MIX_MS = 1200;

  function hex(text) {
    var m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(text || '').trim());
    if (!m) return [0.11, 0.15, 0.16];
    var h = m[1];
    if (h.length === 3) h = h.split('').map(function (c) { return c + c; }).join('');
    return [parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255];
  }

  function paletteColors(name) {
    var entry = palettes[name] || {};
    var c = entry.colors || [];
    var c1 = c[0] || '#009dff', c2 = c[1] || c1, c3 = c[2] || '#1c2628';
    return [hex(c1), hex(c2), hex(c3)];
  }

  function sceneName(name) {
    return SCENES[name] ? name : (SCENES[cfg.style] ? cfg.style : SCENE_NAMES[0]);
  }
  function modeName(name) {
    return name === 'day' || name === 'night' ? name : (cfg.mode === 'day' ? 'day' : 'night');
  }

  function reduced() { return !!(reduce && reduce.matches); }

  function compile(type, source) {
    var shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  function build(scene, mode) {
    var key = scene + ':' + mode;
    if (programs[key]) return programs[key];
    var vs = compile(gl.VERTEX_SHADER, VERT);
    var fs = compile(gl.FRAGMENT_SHADER, SCENES[scene][mode]);
    if (!vs || !fs) return null;
    var program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;
    var entry = { program: program, attrib: gl.getAttribLocation(program, 'p'), u: {} };
    ['u_res', 'u_time', 'u_c1', 'u_c2', 'u_c3'].forEach(function (n) { entry.u[n] = gl.getUniformLocation(program, n); });
    programs[key] = entry;
    return entry;
  }

  function select(scene, mode) {
    var entry = build(scene, mode);
    if (!entry) return false;
    current = entry;
    currentScene = scene;
    currentMode = mode;
    gl.useProgram(entry.program);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.enableVertexAttribArray(entry.attrib);
    gl.vertexAttribPointer(entry.attrib, 2, gl.FLOAT, false, 0, 0);
    return true;
  }

  function setup() {
    var options = { alpha: false, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: false, powerPreference: 'low-power' };
    gl = canvas.getContext('webgl', options) || canvas.getContext('experimental-webgl', options);
    if (!gl) return false;
    buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    var scene = sceneName(root.getAttribute('data-background'));
    var mode = modeName(root.getAttribute('data-mode'));
    return select(scene, mode) || select(SCENE_NAMES[0], 'night');
  }

  function resize() {
    var w = window.innerWidth || 1, h = window.innerHeight || 1;
    var scale = Math.max(1, Math.hypot(w, h) / pixelFilter);
    var cw = Math.max(1, Math.round(w / scale)), ch = Math.max(1, Math.round(h / scale));
    if (canvas.width !== cw || canvas.height !== ch) {
      canvas.width = cw;
      canvas.height = ch;
    }
    if (gl) gl.viewport(0, 0, cw, ch);
  }

  function draw() {
    if (!gl || !current) return;
    gl.uniform2f(current.u.u_res, canvas.width, canvas.height);
    gl.uniform1f(current.u.u_time, time);
    gl.uniform3fv(current.u.u_c1, colors[0]);
    gl.uniform3fv(current.u.u_c2, colors[1]);
    gl.uniform3fv(current.u.u_c3, colors[2]);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  function ease(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }

  function mixColors(now) {
    if (!from) return;
    var k = Math.min(1, (now - mixStart) / MIX_MS);
    var e = ease(k);
    for (var i = 0; i < 3; i++) {
      for (var j = 0; j < 3; j++) colors[i][j] = from[i][j] + (to[i][j] - from[i][j]) * e;
    }
    if (k >= 1) { from = null; to = null; }
  }

  function frame(now) {
    if (!running) return;
    frameHandle = requestAnimationFrame(frame);
    var dt = now - last;
    if (dt < interval) return;
    last = now - (dt % interval);
    time = (time + Math.min(dt, 100) / 1000 * speed) % 10000;
    mixColors(now);
    draw();
  }

  function start() {
    if (running || !gl) return;
    running = true;
    last = performance.now();
    frameHandle = requestAnimationFrame(frame);
  }

  function stop() {
    running = false;
    if (frameHandle) cancelAnimationFrame(frameHandle);
    frameHandle = 0;
  }

  // Reduced motion: one still frame, redrawn only when something changes.
  function still() {
    if (!gl) return;
    if (from) { colors = to.map(function (c) { return c.slice(); }); from = null; to = null; }
    draw();
  }

  function setPalette(name, immediate) {
    var target = paletteColors(name);
    if (immediate || reduced()) {
      colors = target.map(function (c) { return c.slice(); });
      from = null; to = null;
      if (reduced()) still();
      return;
    }
    from = colors.map(function (c) { return c.slice(); });
    to = target;
    mixStart = performance.now();
  }

  // Scene or mode change: copy the current frame onto the snapshot canvas, switch shaders
  // underneath, then fade the copy out, so one picture dissolves straight into the next.
  function switchTo(scene, mode, animate) {
    if (!gl || !SCENES[scene] || !SCENES[scene][mode]) return;
    if (scene === currentScene && mode === currentMode) return;
    if (!animate || reduced() || !snapshot) {
      select(scene, mode);
      if (reduced()) still();
      else draw();
      return;
    }
    var ctx = snapshot.getContext('2d');
    if (!ctx) { select(scene, mode); draw(); return; }
    clearTimeout(snapshotTimer);
    snapshot.width = canvas.width;
    snapshot.height = canvas.height;
    draw();
    ctx.drawImage(canvas, 0, 0);
    snapshot.classList.add('is-visible');
    void snapshot.offsetWidth; // commit the opaque state before the fade starts
    select(scene, mode);
    draw();
    requestAnimationFrame(function () {
      snapshot.classList.remove('is-visible');
      snapshotTimer = setTimeout(function () { ctx.clearRect(0, 0, snapshot.width, snapshot.height); }, 600);
    });
  }

  function remember() {
    try { sessionStorage.setItem(TIME_KEY, String(time)); } catch (e) { /* ignore */ }
  }

  function offline() {
    stop();
    holder.classList.add('is-off');
  }

  function boot() {
    if (!setup()) { offline(); return; }
    resize();
    setPalette(root.getAttribute('data-palette') || Object.keys(palettes)[0], true);
    draw(); // first frame before the first paint, so the gradient underneath never shows
    if (!reduced() && !document.hidden) start();
  }

  canvas.addEventListener('webglcontextlost', function (event) {
    event.preventDefault();
    stop();
  });
  canvas.addEventListener('webglcontextrestored', function () {
    programs = {};
    current = null;
    currentScene = '';
    currentMode = '';
    boot();
  });

  window.addEventListener('resize', function () {
    resize();
    if (reduced()) still();
    else draw(); // Resizing clears WebGL's buffer; refill it before this event can paint.
  });

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { stop(); remember(); }
    else if (!reduced()) start();
  });
  window.addEventListener('pagehide', remember);

  if (reduce) {
    var onReduce = function () { if (reduced()) { stop(); still(); } else start(); };
    if (reduce.addEventListener) reduce.addEventListener('change', onReduce);
    else if (reduce.addListener) reduce.addListener(onReduce);
  }

  document.addEventListener('drift:palette', function (event) {
    var name = event.detail && event.detail.name;
    if (name && palettes[name]) setPalette(name, false);
  });

  document.addEventListener('drift:background', function (event) {
    var detail = event.detail || {};
    if (detail.name) switchTo(sceneName(detail.name), currentMode || modeName(null), detail.animate !== false);
  });

  document.addEventListener('drift:mode', function (event) {
    var detail = event.detail || {};
    if (detail.mode) switchTo(currentScene || sceneName(null), modeName(detail.mode), detail.animate !== false);
  });

  boot();
})();
