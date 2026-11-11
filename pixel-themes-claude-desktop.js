// ==UserScript==
// @name         Pixel Chat Themes
// @name:vi      Pixel Chat Themes – hình nền pixel cho claude.ai
// @namespace    https://github.com/aqua2409z/pixel-chat-themes
// @version      1.3.0-desktop.1
// @description  Animated pixel/ASCII wallpapers behind the claude.ai chat. Type /theme to pick one.
// Bản sửa cho app Claude Desktop (tab Code): bloom + lưới + cột đọc thay lớp phủ trắng,
// chữ có viền tương phản, bong bóng tin nhắn đặc, theme Claude Code/Claude Ivory, bot Claude mini.
// @description:vi Hình nền pixel/ASCII chuyển động phía sau khung chat claude.ai. Gõ /theme để chọn.
// @author       aqua2409z (bản gốc), thanhsondev (bản Claude Desktop)
// @license      MIT
// @homepageURL  https://github.com/thanhsondev/claude-theme
// @supportURL   https://github.com/thanhsondev/claude-theme/issues
// @match        https://claude.ai/*
// @grant        none
// @run-at       document-idle
// @inject-into  content
// @noframes
// ==/UserScript==
// Dựa trên Pixel Chat Themes của aqua2409z (MIT): https://github.com/aqua2409z/pixel-chat-themes

/*
 * How it works
 *  1. A full-screen <canvas> sits behind the page (z-index -1) and draws a scene
 *     as a grid of small tiles, each holding one ASCII glyph – the "pixel" look.
 *  2. A scanner finds the page's opaque backgrounds: large ones become
 *     transparent, smaller panels (sidebar, composer, bubbles, menus) become
 *     frosted glass. It only looks at computed styles, not class names, so it
 *     keeps working when claude.ai changes its markup.
 *  3. Typing /theme in the chat box (or the floating button, or Alt+T) opens a
 *     picker. Settings are kept in localStorage.
 *
 * No innerHTML and no inline <style> (CSSOM only), so it also works on pages
 * with a strict Content-Security-Policy / Trusted Types.
 */
(function () {
  'use strict';
  // A clear line in the console, so a run from DevTools shows it worked.
  const say = (text) => console.info('%c' + text, 'color:#2f8a58;font-weight:bold');
  const VERSION = '2026.11.11c';
  if (window.__pixelThemes) {
    // An older copy that is still running blocks this one: say so loudly.
    if (window.__pixelThemes.version !== VERSION)
      console.warn('%c⚠ Pixel Themes: BẢN CŨ đang chạy nên bản mới (' + VERSION + ') CHƯA được nạp.\nGõ  location.reload()  rồi Enter, đợi app hiện lại, sau đó chạy lại bản mới.', 'font-size:14px;font-weight:bold');
    else say('Pixel Themes ' + VERSION + ' đang chạy rồi. Bấm Alt+T (hoặc nút ô vuông màu ở cạnh phải) để chọn theme.');
    return;
  }

  /* ------------------------------------------------------------------ utils */

  const rnd = (a, b) => a + Math.random() * (b - a);
  const rint = (a, b) => Math.floor(rnd(a, b + 1));
  const pick = (arr) => arr[(Math.random() * arr.length) | 0];
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

  // Stable pseudo-random number in [0, 1) for integer coordinates.
  function hash(x, y, s) {
    let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(s | 0, 1274126177);
    h = Math.imul(h ^ (h >>> 13), 1103515245);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }

  function rgba(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  }

  function vgrad(c, w, h, stops) {
    const g = c.createLinearGradient(0, 0, 0, h);
    stops.forEach((s, i) => g.addColorStop(i / (stops.length - 1), s));
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
  }

  function rglow(c, x, y, r, hex, a) {
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, rgba(hex, a));
    g.addColorStop(1, rgba(hex, 0));
    c.fillStyle = g;
    c.fillRect(x - r, y - r, r * 2, r * 2);
  }

  // A sprite is ASCII art: every non-space char is a key into a palette of
  // [tileColor, glyphColor, fixedGlyph?, alpha?].
  function sprite(rows, pal) {
    const w = Math.max(...rows.map((r) => r.length));
    return { rows: rows.map((r) => r.padEnd(w)), w, h: rows.length, pal };
  }

  const strip = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').toLowerCase().trim();

  /* ------------------------------------------------------------------ world */

  const FONT = 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace';

  class World {
    constructor(canvas) {
      this.cv = canvas;
      this.ctx = canvas.getContext('2d');
      this.tiles = new Map();
      this.glows = new Map();
      this.s = {};
      this.t = 0;
      this.veil = 0;
      this.veilColor = '#ffffff';
      // "Video look" extras: only the main wallpaper turns these on, thumbnails stay plain.
      this.fx = false;
      this.bloom = 0;
      this.col = null; // reading column {x, w} in CSS px
      this.scrimA = 0;
      this.scrimRGB = '255,255,255';
      this.afterFx = null; // drawn last, above the scrim (the mini bot)
    }

    resize(w, h, cell, dpr) {
      this.w = w;
      this.h = h;
      this.cell = cell;
      this.dpr = dpr;
      this.cv.width = Math.max(1, Math.round(w * dpr));
      this.cv.height = Math.max(1, Math.round(h * dpr));
      this.cols = Math.ceil(w / cell);
      this.rows = Math.ceil(h / cell);
      this.glyphsOn = cell >= 8;
      this.tiles.clear();
      this.under = this.over = this.post = null;
    }

    setTheme(th) {
      this.th = th;
      this.s = {};
      this.t = 0;
      this.tiles.clear();
      this.under = this.over = this.post = null;
      th.init(this);
    }

    // Faint dot grid at the cell corners, like graph paper behind the pixels.
    grid(c) {
      const s = this.cell;
      c.fillStyle = this.th.dark ? 'rgba(255,255,255,0.07)' : 'rgba(40,30,20,0.07)';
      const d = Math.max(1, s * 0.09);
      for (let y = 0; y <= this.h; y += s) for (let x = 0; x <= this.w; x += s) c.fillRect(x - d / 2, y - d / 2, d, d);
    }

    // Vignette + soft colored light leaking in from the edges.
    postLayer(c) {
      const w = this.w;
      const h = this.h;
      const th = this.th;
      const tint = th.tint || '#ffffff';
      const R = Math.hypot(w, h) / 2;
      const v = c.createRadialGradient(w / 2, h / 2, R * 0.45, w / 2, h / 2, R * 1.05);
      v.addColorStop(0, 'rgba(0,0,0,0)');
      v.addColorStop(1, th.dark ? 'rgba(0,0,0,0.42)' : 'rgba(30,20,10,0.12)');
      c.fillStyle = v;
      c.fillRect(0, 0, w, h);
      c.globalCompositeOperation = 'screen';
      rglow(c, w * 1.02, h * 0.18, Math.max(w, h) * 0.42, tint, th.dark ? 0.16 : 0.1);
      rglow(c, w * -0.04, h * 1.02, Math.max(w, h) * 0.38, tint, th.dark ? 0.12 : 0.08);
      c.globalCompositeOperation = 'source-over';
    }

    // Cheap bloom: shrink the frame, blur it a little, add it back on top.
    bloomPass() {
      const cv = this.cv;
      const bw = Math.max(1, Math.round(cv.width / 6));
      const bh = Math.max(1, Math.round(cv.height / 6));
      if (!this.bc || this.bc.width !== bw || this.bc.height !== bh) {
        this.bc = document.createElement('canvas');
        this.bc.width = bw;
        this.bc.height = bh;
      }
      const b = this.bc.getContext('2d');
      b.globalCompositeOperation = 'copy';
      b.filter = 'blur(2px)';
      b.drawImage(cv, 0, 0, bw, bh);
      b.filter = 'none';
      const ctx = this.ctx;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = 'screen';
      ctx.globalAlpha = this.bloom;
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(this.bc, 0, 0, cv.width, cv.height);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    }

    // A soft band behind the chat column keeps text readable; the edges stay vivid.
    scrim() {
      const col = this.col;
      if (!col || this.scrimA <= 0.01) return;
      const f = Math.min(140, col.w * 0.25);
      const x0 = col.x - f;
      const x1 = col.x + col.w + f;
      const g = this.ctx.createLinearGradient(x0, 0, x1, 0);
      const c = this.scrimRGB;
      const a = this.scrimA;
      const e = f / (x1 - x0);
      g.addColorStop(0, `rgba(${c},0)`);
      g.addColorStop(e, `rgba(${c},${a})`);
      g.addColorStop(1 - e, `rgba(${c},${a})`);
      g.addColorStop(1, `rgba(${c},0)`);
      this.ctx.fillStyle = g;
      this.ctx.fillRect(x0, 0, x1 - x0, this.h);
    }

    // Static parts of a scene are drawn once into an offscreen layer.
    layer(fn) {
      const c = document.createElement('canvas');
      c.width = this.cv.width;
      c.height = this.cv.height;
      const x = c.getContext('2d');
      x.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      const prev = this.ctx;
      this.ctx = x;
      try {
        fn(x);
      } finally {
        this.ctx = prev;
      }
      return c;
    }

    draw(dt) {
      const th = this.th;
      const ctx = this.ctx;
      if (!th) return;
      this.t += dt;
      if (!this.under) {
        this.under = this.layer((c) => {
          th.bg(c, this.w, this.h, this);
          if (this.fx) this.grid(c);
          if (th.under) th.under(this);
        });
      }
      if (th.over && !this.over) this.over = this.layer(() => th.over(this));
      if (this.fx && !this.post) this.post = this.layer((c) => this.postLayer(c));

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(this.under, 0, 0);
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      th.frame(this, dt);
      if (this.over) {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.drawImage(this.over, 0, 0);
        ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      }
      if (this.fx) {
        if (this.bloom > 0) this.bloomPass();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.drawImage(this.post, 0, 0);
        ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
        this.scrim();
      }
      if (this.veil > 0) {
        ctx.globalAlpha = this.veil;
        ctx.fillStyle = this.veilColor;
        ctx.fillRect(0, 0, this.w, this.h);
        ctx.globalAlpha = 1;
      }
      if (this.afterFx) this.afterFx(this, dt);
    }

    // Draws one cached tile at a pixel position (used by the mini bot, off the grid).
    tileAt(px, py, size, bg, fg, ch, a = 1) {
      if (a <= 0.01) return;
      this.ctx.globalAlpha = a > 1 ? 1 : a;
      this.ctx.drawImage(this.img(bg, fg, ch), px, py, size, size);
      this.ctx.globalAlpha = 1;
    }

    // One tile = rounded square + glyph, rendered once and reused.
    img(bg, fg, ch) {
      const key = bg + '|' + fg + '|' + ch;
      let c = this.tiles.get(key);
      if (c) return c;
      if (this.tiles.size > 900) this.tiles.clear();
      const s = this.cell;
      const px = Math.max(1, Math.ceil(s * this.dpr));
      c = document.createElement('canvas');
      c.width = c.height = px;
      const x = c.getContext('2d');
      x.scale(px / s, px / s);
      if (bg) {
        const gap = s > 6 ? Math.max(1, s * 0.09) : 0.5;
        const r = s > 6 ? s * 0.16 : 0;
        x.fillStyle = bg;
        if (r && x.roundRect) {
          x.beginPath();
          x.roundRect(gap / 2, gap / 2, s - gap, s - gap, r);
          x.fill();
        } else {
          x.fillRect(gap / 2, gap / 2, s - gap, s - gap);
        }
      }
      if (ch && fg && this.glyphsOn) {
        x.fillStyle = fg;
        x.font = `600 ${Math.round(s * 0.7)}px ${FONT}`;
        x.textAlign = 'center';
        x.textBaseline = 'middle';
        x.fillText(ch, s / 2, s / 2 + s * 0.05);
      } else if (ch && fg && !bg) {
        const d = Math.max(1, s * 0.4);
        x.fillStyle = fg;
        x.fillRect((s - d) / 2, (s - d) / 2, d, d);
      }
      this.tiles.set(key, c);
      return c;
    }

    tile(x, y, bg, fg, ch, a = 1) {
      x = Math.round(x);
      y = Math.round(y);
      if (a <= 0.01 || x < 0 || y < 0 || x >= this.cols || y >= this.rows) return;
      const ctx = this.ctx;
      ctx.globalAlpha = a > 1 ? 1 : a;
      ctx.drawImage(this.img(bg, fg, ch), x * this.cell, y * this.cell, this.cell, this.cell);
      ctx.globalAlpha = 1;
    }

    glyph(x, y, ch, fg, a) {
      this.tile(x, y, null, fg, ch, a);
    }

    ch(i, j, seed) {
      const g = this.th.glyphs;
      return g[(hash(i, j, seed) * g.length) | 0];
    }

    sprite(sp, x, y, o = {}) {
      const X = Math.round(x);
      const Y = Math.round(y);
      const pal = o.pal || sp.pal;
      const a = o.a == null ? 1 : o.a;
      const seed = o.seed || 0;
      for (let j = 0; j < sp.h; j++) {
        const row = sp.rows[j];
        for (let i = 0; i < sp.w; i++) {
          const p = pal[row[i]];
          if (!p) continue;
          const gx = X + (o.flip ? sp.w - 1 - i : i);
          this.tile(gx, Y + j, p[0], p[1], p[2] != null ? p[2] : this.ch(i, j, seed), a * (p[3] == null ? 1 : p[3]));
        }
      }
    }

    glow(x, y, r, hex, a) {
      if (a <= 0.01) return;
      let g = this.glows.get(hex);
      if (!g) {
        g = document.createElement('canvas');
        g.width = g.height = 64;
        rglow(g.getContext('2d'), 32, 32, 32, hex, 1);
        this.glows.set(hex, g);
      }
      const c = this.cell;
      const R = r * c;
      this.ctx.globalAlpha = clamp(a, 0, 1);
      this.ctx.drawImage(g, (x + 0.5) * c - R, (y + 0.5) * c - R, R * 2, R * 2);
      this.ctx.globalAlpha = 1;
    }

    dot(x, y, color, a, size = 0.3) {
      if (a <= 0.01) return;
      const c = this.cell;
      const d = Math.max(1, c * size);
      this.ctx.globalAlpha = clamp(a, 0, 1);
      this.ctx.fillStyle = color;
      this.ctx.fillRect(Math.round(x) * c + (c - d) / 2, Math.round(y) * c + (c - d) / 2, d, d);
      this.ctx.globalAlpha = 1;
    }
  }

  /* ---------------------------------------------------------------- sprites */

  const CLOUD_DAY = { c: ['#ffffff', '#a9c1d6'], e: ['#eef6fd', '#c3d5e5'] };
  const CLOUD_NIGHT = { c: ['#27306e', '#323d86'], e: ['#222a61', '#2c3678'] };

  // Flat-bottomed cloud made of a few overlapping ellipses.
  function cloudRows(w, h) {
    const E = [{ x: w / 2, y: h - h * 0.32, rx: w / 2, ry: h * 0.34 }];
    for (let k = rint(2, 4); k > 0; k--) {
      const rx = rnd(w * 0.16, w * 0.3);
      E.push({ x: rnd(rx * 0.9, w - rx * 0.9), y: h - h * 0.4 - rnd(0, h * 0.2), rx, ry: Math.min(rx * 0.8, h * 0.6) });
    }
    const inside = (i, j) => E.some((e) => ((i + 0.5 - e.x) / e.rx) ** 2 + ((j + 0.5 - e.y) / e.ry) ** 2 <= 1);
    const rows = [];
    for (let j = 0; j < h; j++) {
      let r = '';
      for (let i = 0; i < w; i++) {
        if (!inside(i, j)) r += ' ';
        else r += !inside(i - 1, j) || !inside(i + 1, j) || !inside(i, j - 1) || !inside(i, j + 1) ? 'e' : 'c';
      }
      rows.push(r);
    }
    return rows;
  }

  function cloud(w, anywhere, pal) {
    const z = Math.random();
    const cw = Math.round(clamp(w.cols * 0.12, 7, 16) + z * clamp(w.cols * 0.14, 4, 16));
    const ch = Math.max(3, Math.round(cw * rnd(0.3, 0.42)));
    return {
      sp: sprite(cloudRows(cw, ch), pal),
      z,
      x: anywhere ? rnd(-cw, w.cols) : -cw - rnd(0, w.cols * 0.3),
      y: rnd(-1, w.rows * 0.85 - ch),
      v: 0.35 + z * 1.2,
      a: 0.55 + z * 0.45,
      seed: rint(1, 1e6),
    };
  }

  const TURTLE_PAL = {
    S: ['#2f8a58', '#1f6a42'],
    s: ['#a3d06c', '#78a847'],
    h: ['#8dd27f', '#5ba454'],
    f: ['#72bf76', '#4d9a52'],
    e: ['#17322a', null, ''],
  };
  const TURTLE = [
    sprite(['      ff      ', '    SSSSSf    ', '  SsSSsSSS he ', ' SSsSSsSSSShhh', '  SsSSsSSS hh ', '    SSSSSf    ', '      ff      '], TURTLE_PAL),
    sprite(['        ff    ', '    SSSSSff   ', '  SsSSsSSS he ', ' SSsSSsSSSShhh', '  SsSSsSSS hh ', '    SSSSSff   ', '        ff    '], TURTLE_PAL),
  ];

  const FISH = sprite(['t yyy ', 'tyyyey', 't yyy '], {
    y: ['#ffd23f', '#f2a900'],
    t: ['#ffb000', '#d98a00'],
    e: ['#1b2f4a', null, ''],
  });

  const CORALS = [
    ['#ff7d8c', '#d6566a', '#ffb3bd'],
    ['#ff9f5a', '#d77a33', '#ffc79c'],
    ['#c79bff', '#9c70e0', '#e2cdff'],
    ['#ff6fb3', '#d9468d', '#ffacd4'],
  ];

  const KOI = [
    sprite(['     f     ', 't  ooWWoo  ', 'ttoWWooWWoo', '   ooWWoo  ', '     f     '], null),
    sprite(['     f     ', '   ooWWoo  ', 'ttoWWooWWoo', 't  ooWWoo  ', '     f     '], null),
  ];
  const koiPal = (o, W, t) => ({ o, W, t: [t, o[1], '', 0.85], f: [W[0], W[1], '', 0.6] });
  const KOI_PALS = [
    koiPal(['#e8533a', '#b83a25'], ['#fff6ec', '#e3d2bf'], '#ff8a6b'),
    koiPal(['#ffb21f', '#d98e00'], ['#ffe39a', '#e2c066'], '#ffc94d'),
    koiPal(['#ff7b2e', '#cf5617'], ['#2b2b2b', '#4a4a4a'], '#ff9a5c'),
    koiPal(['#f4f3ee', '#cfcdc4'], ['#ffffff', '#dddddd'], '#ffffff'),
  ];

  const JELLY = [
    sprite(['   bbb   ', ' bBBBBBb ', 'bBBbBbBBb', 'b b b b b', ' t  t  t ', '  t  t  t', ' t  t  t ', '  t  t   '], null),
    sprite(['   bbb   ', '  bBBBb  ', ' bBbBbBb ', '  b b b  ', '  t t t  ', '  t t t  ', '   t t t ', '  t t t  ', '   t t   '], null),
  ];
  const JELLY_COLS = [
    ['#ff8fc8', '#ffd1e8'],
    ['#b49cff', '#e0d6ff'],
    ['#74dcff', '#c9f2ff'],
    ['#ffb08a', '#ffe0cf'],
  ];
  const jellyPal = (m, l) => ({ B: [m, l, null, 0.9], b: [l, m, null, 0.8], t: [null, l, '|', 0.7] });

  const BOAT = sprite(['    m    ', '    mM   ', '   mmMM  ', '  mmmMMM ', 'hhhhhhhhh', ' hhhhhhh ', '  hhhhh  '], null);
  const boatPal = (a, b, c) => ({ m: [a, c], M: [b, c], h: [a, c] });
  const BOAT_PALS = [
    boatPal('#ffffff', '#e4ecef', '#b9c7ce'),
    boatPal('#fff3c4', '#f0e0a0', '#cdb877'),
    boatPal('#ffe1ea', '#f4c8d6', '#d39bb0'),
  ];

  const CODE_LINES = [
    'const theme = "pixel";',
    '$ npm run dev',
    '=> ready in 312ms',
    'git commit -m "wip"',
    '<Chat theme={t} />',
    'fn render() {',
    '}',
    '// TODO: sleep',
    'ok',
    '[ok] 42 tests passed',
  ];

  /* ------------------------------------------------- Claude spark + dust */

  // [core, inner, mid, tip] tile colors and the glyph color.
  const SPARK_DARK = { stops: ['#fcd9c6', '#f4a882', '#de7c5a', '#b5583a'], fg: '#7a3520' };
  const SPARK_LIGHT = { stops: ['#fff0e6', '#f7bc9d', '#e5845f', '#c4613f'], fg: '#8a3b22' };

  function sparkInit(w, dustGlyphs, seed) {
    const s = w.s;
    const n = Math.round(clamp((w.cols * w.rows) / 80, 24, 170));
    s.dust = Array.from({ length: n }, () => ({
      x: rnd(0, w.cols),
      y: rnd(0, w.rows),
      vx: rnd(0.05, 0.35),
      vy: rnd(-0.35, -0.05),
      ch: pick(dustGlyphs),
      a: rnd(0.15, 0.55),
      ph: rnd(0, 6.3),
    }));
    s.embers = Array.from({ length: Math.round(n / 6) }, () => ({ x: rnd(0, w.cols), y: rnd(0, w.rows), v: rnd(0.4, 1.2), ph: rnd(0, 6.3) }));
    s.rays = Array.from({ length: 12 }, (_, k) => 0.62 + 0.38 * hash(k, seed, 77));
  }

  function dustFrame(w, dt, glyphColor, emberColor) {
    const s = w.s;
    for (const d of s.dust) {
      d.x += d.vx * dt;
      d.y += d.vy * dt + Math.sin(w.t * 0.7 + d.ph) * 0.08 * dt;
      if (d.x > w.cols + 1) d.x = -1;
      if (d.y < -1) d.y = w.rows + 1;
      w.glyph(d.x, d.y, d.ch, glyphColor, d.a * (0.55 + 0.45 * Math.sin(w.t * 1.3 + d.ph)));
    }
    for (const e of s.embers) {
      e.y -= e.v * dt;
      e.x += Math.sin(w.t * 1.5 + e.ph) * 0.3 * dt;
      if (e.y < -1) {
        e.y = w.rows + 1;
        e.x = rnd(0, w.cols);
      }
      w.dot(e.x, e.y, emberColor, 0.2 + 0.5 * Math.abs(Math.sin(w.t * 2 + e.ph)), 0.3);
    }
  }

  // The big pixel spark: twelve rays of uneven length around a dense, light core.
  function sparkFrame(w, fx, fy, pal) {
    const s = w.s;
    const cx = Math.round(w.cols * fx);
    const cy = Math.round(w.rows * fy);
    const R = clamp(Math.round(Math.min(w.cols, w.rows) * 0.21), 5, 16);
    const rot = w.t * 0.035;
    const flick = Math.floor(w.t * 2.2);
    const seen = new Set();
    const put = (x, y, f, k, i) => {
      const key = x * 4096 + y;
      if (seen.has(key)) return;
      seen.add(key);
      const st = pal.stops;
      const bg = f < 0.18 ? st[0] : f < 0.45 ? st[1] : f < 0.8 ? st[2] : st[3];
      w.tile(x, y, bg, pal.fg, w.ch(k * 31 + i, flick + ((k + i) % 3), 3));
    };
    w.glow(cx, cy, R * 2.8, pal.stops[2], 0.34 + 0.08 * Math.sin(w.t * 1.6));
    // Core disc.
    const core = Math.max(2, Math.round(R * 0.34));
    for (let dy = -core; dy <= core; dy++) for (let dx = -core; dx <= core; dx++) if (dx * dx + dy * dy <= core * core + 0.5) put(cx + dx, cy + dy, Math.hypot(dx, dy) / R, 0, dx * 7 + dy);
    for (let k = 0; k < 12; k++) {
      const a = rot + (k / 12) * Math.PI * 2;
      const L = Math.max(core + 1, Math.round(R * s.rays[k] + Math.sin(w.t * 1.25 + k * 2.1) * 1.1));
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      for (let i = 1; i <= L; i++) {
        const x = cx + Math.round(ca * i);
        const y = cy + Math.round(sa * i);
        put(x, y, i / L, k, i);
        // Rays taper: three tiles wide near the core, two in the middle, one at the tip.
        if (i < L * 0.75) put(cx + Math.round(ca * i - sa), cy + Math.round(sa * i + ca), i / L + 0.06, k, i + 50);
        if (i < L * 0.42) put(cx + Math.round(ca * i + sa), cy + Math.round(sa * i - ca), i / L + 0.06, k, i + 90);
      }
    }
  }

  /* ----------------------------------------------------------------- themes */

  const THEMES = [];

  THEMES.push({
    id: 'code',
    name: 'Claude Code',
    dark: true,
    tint: '#d97757',
    alias: ['terminal', 'spark', 'claude code', 'cam'],
    glyphs: 'tS%$*+:;',
    bg(c, w, h) {
      vgrad(c, w, h, ['#1d1714', '#151110', '#0d0b0a']);
      rglow(c, w * 0.8, h * 0.3, Math.max(w, h) * 0.5, '#d97757', 0.2);
      rglow(c, w * 0.15, h * 0.95, Math.max(w, h) * 0.35, '#a24e2f', 0.1);
    },
    init(w) {
      sparkInit(w, '<>(){}:;.,\'`~', 1);
    },
    frame(w, dt) {
      dustFrame(w, dt, '#6e5b51', '#ff9a66');
      sparkFrame(w, 0.84, 0.28, SPARK_DARK);
    },
  });

  THEMES.push({
    id: 'claude',
    name: 'Claude Ivory',
    dark: false,
    tint: '#e8906b',
    veilScale: 0.5,
    alias: ['claude', 'ivory', 'kem', 'sang', 'anthropic'],
    glyphs: 'tS%$*+:;',
    bg(c, w, h) {
      vgrad(c, w, h, ['#fbf7f0', '#f4ede1', '#ece2d2']);
      rglow(c, w * 0.78, h * 0.32, Math.max(w, h) * 0.45, '#f2b08f', 0.28);
      rglow(c, w * 0.1, h * 0.9, Math.max(w, h) * 0.3, '#e8c9a8', 0.25);
    },
    init(w) {
      sparkInit(w, '<>(){}:;.,\'`~', 2);
    },
    frame(w, dt) {
      dustFrame(w, dt, '#c4ab93', '#e8906b');
      sparkFrame(w, 0.84, 0.3, SPARK_LIGHT);
    },
  });

  THEMES.push({
    id: 'cloud',
    name: 'Cloud Drift',
    dark: false,
    alias: ['may', 'troi', 'sky', 'clouds'],
    glyphs: 't%i:;tt%',
    bg(c, w, h) {
      vgrad(c, w, h, ['#86c3f2', '#b3dbf8', '#d9eefc']);
      const g = c.createLinearGradient(0, 0, w, 0);
      g.addColorStop(0, 'rgba(255,255,255,0)');
      g.addColorStop(0.5, 'rgba(255,255,255,0.3)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g;
      c.fillRect(0, 0, w, h);
    },
    init(w) {
      const s = w.s;
      s.clouds = Array.from({ length: Math.round(clamp((w.cols * w.rows) / 700, 3, 10)) }, () => cloud(w, true, CLOUD_DAY));
      s.dust = Array.from({ length: Math.round(clamp((w.cols * w.rows) / 200, 6, 40)) }, () => ({ x: rnd(0, w.cols), y: rnd(0, w.rows), v: rnd(0.2, 0.6), ph: rnd(0, 6) }));
    },
    frame(w, dt) {
      const s = w.s;
      for (const d of s.dust) {
        d.y -= d.v * dt;
        if (d.y < -1) {
          d.y = w.rows + 1;
          d.x = rnd(0, w.cols);
        }
        w.dot(d.x + Math.sin(w.t * 0.7 + d.ph) * 0.8, d.y, '#ffffff', 0.5, 0.22);
      }
      s.clouds.sort((a, b) => a.z - b.z);
      for (let i = 0; i < s.clouds.length; i++) {
        const c = s.clouds[i];
        c.x += c.v * dt;
        if (c.x > w.cols + 1) s.clouds[i] = cloud(w, false, CLOUD_DAY);
        w.sprite(c.sp, c.x, c.y, { a: c.a, seed: c.seed });
      }
    },
  });

  function sandH(x, seed) {
    return 2 + Math.round(0.8 + Math.sin(x * 0.13 + seed) * 0.9 + hash(x, 0, seed) * 0.8);
  }

  function turtle(w, any) {
    const dir = Math.random() < 0.5 ? 1 : -1;
    return { dir, x: any ? rnd(0, w.cols) : dir > 0 ? -15 : w.cols + 1, y0: rnd(2, w.rows * 0.6), v: rnd(1.2, 2), ph: rnd(0, 6) };
  }

  function school(w, any) {
    const dir = Math.random() < 0.5 ? 1 : -1;
    return {
      dir,
      x: any ? rnd(0, w.cols) : dir > 0 ? -12 : w.cols + 8,
      y: rnd(3, w.rows * 0.7),
      v: rnd(2.5, 4),
      fish: Array.from({ length: rint(3, 6) }, () => ({ dx: rnd(-6, 6), dy: rnd(-3, 3), ph: rnd(0, 6) })),
    };
  }

  THEMES.push({
    id: 'lagoon',
    name: 'Honu Lagoon',
    dark: false,
    alias: ['rua', 'honu', 'bien', 'sea', 'turtle'],
    glyphs: '~o.:*',
    bg(c, w, h) {
      vgrad(c, w, h, ['#6fdad4', '#34b6c4', '#1b86a3']);
      rglow(c, w * 0.5, -h * 0.1, h * 0.9, '#ffffff', 0.25);
    },
    init(w) {
      const s = w.s;
      const C = w.cols;
      const R = w.rows;
      s.seed = rint(1, 1e5);
      s.coral = Array.from({ length: Math.round(clamp(C / 12, 2, 10)) }, () => {
        const x0 = rint(1, C - 2);
        const cells = [];
        for (let b = rint(2, 4); b > 0; b--) {
          let x = x0 + rint(-2, 2);
          const L = rint(2, 6);
          for (let i = 0; i < L; i++) {
            cells.push([x, i, i === L - 1]);
            if (Math.random() < 0.3) x += pick([-1, 1]);
          }
        }
        return { x0, cells, col: pick(CORALS) };
      });
      s.weed = Array.from({ length: Math.round(clamp(C / 8, 3, 16)) }, () => ({ x: rint(0, C - 1), h: rint(3, Math.max(4, Math.round(R * 0.28))), ph: rnd(0, 6) }));
      s.turtles = Array.from({ length: C > 70 ? 2 : 1 }, () => turtle(w, true));
      s.schools = Array.from({ length: C > 70 ? 3 : 2 }, () => school(w, true));
      s.bubbles = Array.from({ length: Math.round(clamp(C / 5, 5, 30)) }, () => ({ x: rnd(0, C), y: rnd(0, R), v: rnd(1, 2.5), ph: rnd(0, 6) }));
    },
    under(w) {
      const s = w.s;
      for (let x = 0; x < w.cols; x++) {
        const top = w.rows - sandH(x, s.seed);
        for (let y = top; y < w.rows; y++) w.tile(x, y, y === top ? '#fae8bf' : '#f5dda4', '#dfc07c', w.ch(x, y, 5));
      }
      for (const c of s.coral) {
        const base = w.rows - sandH(c.x0, s.seed) - 1;
        for (const [x, up, tip] of c.cells) w.tile(x, base - up, tip ? c.col[2] : c.col[0], c.col[1], tip ? 'o' : w.ch(x, up, 6));
      }
    },
    frame(w, dt) {
      const s = w.s;
      const ctx = w.ctx;
      // Soft light rays.
      ctx.fillStyle = '#ffffff';
      for (let k = 0; k < 4; k++) {
        const x0 = ((k + 0.5) / 4) * w.w + Math.sin(w.t * 0.2 + k) * 30;
        const sp = w.w * 0.04;
        ctx.globalAlpha = 0.05 + 0.035 * Math.sin(w.t * 0.5 + k * 2);
        ctx.beginPath();
        ctx.moveTo(x0 - sp, 0);
        ctx.lineTo(x0 + sp, 0);
        ctx.lineTo(x0 + sp * 3 - w.h * 0.3, w.h);
        ctx.lineTo(x0 - sp * 2 - w.h * 0.3, w.h);
        ctx.closePath();
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      for (const g of s.weed) {
        const base = w.rows - sandH(g.x, s.seed) - 1;
        for (let k = 0; k < g.h; k++) {
          const off = Math.round(Math.sin(w.t * 1.2 + g.ph + k * 0.5) * (k / g.h) * 1.6);
          w.tile(g.x + off, base - k, k > g.h - 2 ? '#6fd08c' : '#3daa6a', '#2a8752', w.ch(g.x, k, 8));
        }
      }
      for (let i = 0; i < s.schools.length; i++) {
        const sc = s.schools[i];
        sc.x += sc.dir * sc.v * dt;
        if (sc.x > w.cols + 10 || sc.x < -16) s.schools[i] = school(w, false);
        for (const f of sc.fish) w.sprite(FISH, sc.x + f.dx, sc.y + f.dy + Math.sin(w.t * 2 + f.ph) * 0.5, { flip: sc.dir < 0, seed: 2 });
      }
      for (let i = 0; i < s.turtles.length; i++) {
        const t = s.turtles[i];
        t.x += t.dir * t.v * dt;
        if (t.x > w.cols + 2 || t.x < -16) s.turtles[i] = turtle(w, false);
        const fr = Math.floor(w.t * 2 + t.ph) % 2;
        w.sprite(TURTLE[fr], t.x, t.y0 + Math.sin(w.t * 0.5 + t.ph) * 1.5, { flip: t.dir < 0, seed: 9 });
      }
      for (const b of s.bubbles) {
        b.y -= b.v * dt;
        if (b.y < -1) {
          b.y = w.rows + rnd(0, 5);
          b.x = rnd(0, w.cols);
        }
        w.glyph(b.x + Math.sin(w.t * 2 + b.ph) * 0.6, b.y, b.v > 1.8 ? 'o' : '°', '#effffd', 0.65);
      }
    },
  });

  THEMES.push({
    id: 'koi',
    name: 'Koi Pond',
    dark: true,
    alias: ['ca', 'ca koi', 'ho', 'pond'],
    glyphs: '~:.o',
    bg(c, w, h) {
      vgrad(c, w, h, ['#13706a', '#0d5458', '#093b42']);
      rglow(c, w * 0.3, h * 0.3, Math.max(w, h) * 0.5, '#3fd1b4', 0.12);
    },
    init(w) {
      const s = w.s;
      const C = w.cols;
      const R = w.rows;
      s.koi = Array.from({ length: Math.round(clamp((C * R) / 700, 2, 9)) }, () => ({
        x: rnd(4, Math.max(5, C - 14)),
        y: rnd(2, Math.max(3, R - 6)),
        a: rnd(0, 6.28),
        v: rnd(1.3, 2.4),
        turn: 0,
        pal: pick(KOI_PALS),
        ph: rnd(0, 6),
      }));
      s.pads = Array.from({ length: Math.round(clamp((C * R) / 500, 3, 12)) }, () => ({
        x: Math.round(rnd(0, C)),
        y: Math.round(rnd(0, R)),
        r: rint(2, C > 60 ? 4 : 3),
        n: rnd(0, 6.28),
        lotus: Math.random() < 0.3,
      }));
      s.ripples = [];
      s.next = 0.5;
      s.specks = Array.from({ length: Math.round(clamp((C * R) / 120, 10, 60)) }, () => ({ x: rnd(0, C), y: rnd(0, R), ph: rnd(0, 6) }));
    },
    over(w) {
      for (const p of w.s.pads) {
        for (let pass = 0; pass < 2; pass++) {
          for (let dy = -p.r; dy <= p.r; dy++) {
            for (let dx = -p.r; dx <= p.r; dx++) {
              const d = Math.hypot(dx, dy);
              if (d > p.r + 0.35) continue;
              if (d > 0.8 && Math.abs(angDiff(Math.atan2(dy, dx), p.n)) < 0.45) continue;
              if (pass === 0) {
                w.tile(p.x + dx + 1, p.y + dy + 1, '#04262a', null, '', 0.35);
              } else {
                const edge = d > p.r - 0.65;
                w.tile(p.x + dx, p.y + dy, edge ? '#57ba68' : '#3f9c51', edge ? '#3f9c51' : '#2d7a3d', w.ch(dx, dy, 13));
              }
            }
          }
        }
        if (p.lotus) {
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) w.tile(p.x + dx, p.y + dy, '#ff9fcb', '#e0679d', w.ch(dx, dy, 4));
          w.tile(p.x, p.y, '#ffe27a', '#e0b93f', '*');
        }
      }
    },
    frame(w, dt) {
      const s = w.s;
      for (const p of s.specks) w.dot(p.x, p.y, '#a6efe0', 0.15 + 0.2 * Math.sin(w.t * 1.3 + p.ph), 0.25);

      s.next -= dt;
      if (s.next <= 0) {
        s.ripples.push({ x: rnd(0, w.cols), y: rnd(0, w.rows), r: 0, m: rnd(3, 6) });
        s.next = rnd(0.8, 2.2);
      }
      s.ripples = s.ripples.filter((r) => (r.r += 2.2 * dt) < r.m);
      for (const r of s.ripples) {
        const n = Math.max(6, Math.round(r.r * 6.3));
        for (let k = 0; k < n; k++) {
          const a = (k / n) * Math.PI * 2;
          w.dot(r.x + Math.cos(a) * r.r, r.y + Math.sin(a) * r.r, '#c8f7ee', 0.55 * (1 - r.r / r.m), 0.35);
        }
      }

      for (const k of s.koi) {
        k.turn = clamp(k.turn + rnd(-1, 1) * dt * 1.2, -0.7, 0.7);
        k.a += k.turn * dt;
        if (k.x < 3 || k.x > w.cols - 14 || k.y < 1 || k.y > w.rows - 6) {
          k.a += angDiff(Math.atan2(w.rows / 2 - k.y, w.cols / 2 - k.x), k.a) * Math.min(1, dt * 2);
        }
        k.x += Math.cos(k.a) * k.v * dt;
        k.y += Math.sin(k.a) * k.v * dt * 0.7;
        w.sprite(KOI[Math.floor(w.t * 3 + k.ph) % 2], k.x, k.y, { flip: Math.cos(k.a) < 0, pal: k.pal, seed: 5 });
      }
    },
  });

  function jelly(w, any) {
    const col = pick(JELLY_COLS);
    return { x: rnd(0, Math.max(1, w.cols - 9)), y: any ? rnd(0, w.rows) : w.rows + rnd(0, 6), v: rnd(0.6, 1.2), ph: rnd(0, 1), pal: jellyPal(col[0], col[1]), col: col[0] };
  }

  THEMES.push({
    id: 'jelly',
    name: 'Jellyfish',
    dark: true,
    alias: ['sua', 'jellyfish', 'deep', 'dai duong'],
    glyphs: '~*.:o',
    bg(c, w, h) {
      vgrad(c, w, h, ['#0b3c6b', '#072a52', '#030f24']);
      rglow(c, w * 0.5, -h * 0.15, h, '#5bb6ff', 0.2);
    },
    init(w) {
      const s = w.s;
      s.j = Array.from({ length: Math.round(clamp((w.cols * w.rows) / 600, 2, 10)) }, () => jelly(w, true));
      s.snow = Array.from({ length: Math.round(clamp((w.cols * w.rows) / 90, 10, 80)) }, () => ({ x: rnd(0, w.cols), y: rnd(0, w.rows), v: rnd(0.2, 0.6), ph: rnd(0, 6) }));
    },
    frame(w, dt) {
      const s = w.s;
      for (const p of s.snow) {
        p.y += p.v * dt;
        if (p.y > w.rows + 1) {
          p.y = -1;
          p.x = rnd(0, w.cols);
        }
        w.dot(p.x + Math.sin(w.t * 0.5 + p.ph), p.y, '#bfe6ff', 0.35, 0.22);
      }
      for (let i = 0; i < s.j.length; i++) {
        const j = s.j[i];
        const push = (w.t * 0.7 * j.v + j.ph) % 1 < 0.3;
        j.y -= (push ? 2.4 : 0.45) * j.v * dt;
        j.x += Math.sin(w.t * 0.35 + j.ph * 6) * 0.3 * dt;
        if (j.y < -10) s.j[i] = jelly(w, false);
        w.glow(j.x + 4, j.y + 1.5, 5.5, j.col, 0.28);
        w.sprite(JELLY[push ? 1 : 0], j.x, j.y, { pal: j.pal, seed: 3 });
      }
    },
  });

  function boat(w, any) {
    return { x: any ? rnd(-9, w.cols) : -10, base: rint(Math.round(w.rows * 0.25), Math.max(Math.round(w.rows * 0.25), w.rows - 8)), v: rnd(0.5, 1.1), ph: rnd(0, 6), pal: pick(BOAT_PALS) };
  }

  THEMES.push({
    id: 'boats',
    name: 'Paper Boats',
    dark: false,
    alias: ['thuyen', 'thuyen giay', 'boat'],
    glyphs: '~-.',
    bg(c, w, h) {
      vgrad(c, w, h, ['#d4f4ee', '#9fdfd8', '#63c2c4']);
      rglow(c, w * 0.8, h * 0.05, h * 0.6, '#ffffff', 0.35);
    },
    init(w) {
      const s = w.s;
      const top = Math.round(w.rows * 0.22);
      s.bands = [];
      for (let y = top; y < w.rows; y += rint(3, 5)) s.bands.push({ y, k: s.bands.length, v: rnd(0.4, 1.2) * (s.bands.length % 2 ? -1 : 1), off: rnd(0, 100) });
      s.boats = Array.from({ length: Math.round(clamp((w.cols * w.rows) / 900, 2, 8)) }, () => boat(w, true)).sort((a, b) => a.base - b.base);
      s.glints = Array.from({ length: Math.round(clamp((w.cols * w.rows) / 200, 6, 40)) }, () => ({ x: rint(0, w.cols), y: rint(top, w.rows), ph: rnd(0, 6) }));
    },
    frame(w, dt) {
      const s = w.s;
      for (const b of s.bands) {
        b.off += b.v * dt;
        for (let x = 0; x < w.cols; x++) {
          const u = Math.floor(x + b.off);
          if (hash(u, b.k, 9) > 0.3) continue;
          w.tile(x, b.y + Math.round(Math.sin(u * 0.4 + w.t * 0.8) * 0.5), 'rgba(255,255,255,0.32)', '#ffffff', '~', 0.9);
        }
      }
      for (const g of s.glints) w.glyph(g.x, g.y, '+', '#ffffff', Math.max(0, Math.sin(w.t * 2 + g.ph)) * 0.8);
      for (const b of s.boats) {
        b.x += b.v * dt;
        if (b.x > w.cols + 1) b.x = -10;
        const y = b.base + Math.sin(w.t * 1.3 + b.ph) * 0.6;
        for (let i = 1; i < 8; i++) w.tile(b.x + i, y + 7, '#145a64', null, '', 0.18);
        w.sprite(BOAT, b.x, y, { pal: b.pal, seed: 4 });
      }
    },
  });

  THEMES.push({
    id: 'fireflies',
    name: 'Fireflies',
    dark: true,
    alias: ['dom dom', 'domdom', 'firefly', 'rung', 'forest'],
    glyphs: '|/\\^.',
    bg(c, w, h) {
      vgrad(c, w, h, ['#061210', '#0a1c16', '#0f2a1e']);
      rglow(c, w * 0.15, h * 0.1, h * 0.5, '#9bd88a', 0.07);
    },
    init(w) {
      const s = w.s;
      s.seed = rint(1, 1e5);
      s.f = Array.from({ length: Math.round(clamp((w.cols * w.rows) / 140, 8, 60)) }, () => ({
        x: rnd(0, w.cols),
        y: rnd(0, w.rows * 0.9),
        vx: rnd(-0.5, 0.5),
        vy: rnd(-0.3, 0.3),
        ph: rnd(0, 6),
        f: rnd(0.8, 2),
      }));
    },
    under(w) {
      const C = w.cols;
      const R = w.rows;
      const seed = w.s.seed;
      for (let x = 0; x < C; x++) {
        const hf = Math.round(R * 0.26 + Math.sin(x * 0.08 + seed) * 2.2 + Math.sin(x * 0.21) * 1.2 + hash(x, 1, seed) * 1.4);
        for (let y = R - hf; y < R; y++) w.tile(x, y, '#0e261a', '#133222', w.ch(x, y, 3));
      }
      for (let k = Math.round(clamp(C / 10, 3, 14)); k > 0; k--) {
        const px = Math.round(hash(k, 2, seed) * C);
        const ph = Math.round(R * (0.3 + hash(k, 3, seed) * 0.18));
        for (let j = 0; j < ph; j++) {
          const half = Math.floor(j * 0.32);
          for (let dx = -half; dx <= half; dx++) w.tile(px + dx, R - ph + j, '#0b2016', '#10291b', w.ch(dx, j, 7));
        }
      }
      for (let x = 0; x < C; x++) {
        const hn = Math.round(R * 0.1 + Math.sin(x * 0.3 + seed) + hash(x, 4, seed) * 1.5);
        for (let y = R - hn; y < R; y++) w.tile(x, y, '#08150e', '#0c1f14', w.ch(x, y, 9));
      }
    },
    frame(w, dt) {
      for (const f of w.s.f) {
        f.vx = clamp(f.vx + rnd(-1, 1) * dt, -0.7, 0.7);
        f.vy = clamp(f.vy + rnd(-1, 1) * dt, -0.5, 0.5);
        f.x += f.vx * dt;
        f.y += f.vy * dt;
        if (f.x < 0 || f.x > w.cols) {
          f.vx = -f.vx;
          f.x = clamp(f.x, 0, w.cols);
        }
        if (f.y < 1 || f.y > w.rows - 2) {
          f.vy = -f.vy;
          f.y = clamp(f.y, 1, w.rows - 2);
        }
        let b = Math.sin(w.t * f.f + f.ph);
        b = b > 0 ? b * b : 0;
        w.glow(f.x, f.y, 2.8, '#d9ff6e', b * 0.5);
        w.tile(f.x, f.y, '#f1ffa6', '#a9cf3a', '·', 0.2 + 0.8 * b);
      }
    },
  });

  function moonGeo(w) {
    return {
      sea: Math.round(w.rows * 0.8),
      mx: Math.round(w.cols * 0.78),
      my: Math.max(3, Math.round(w.rows * 0.2)),
      mr: clamp(Math.round(Math.min(w.cols, w.rows) * 0.08), 2, 7),
    };
  }

  THEMES.push({
    id: 'moon',
    name: 'Moonlit',
    dark: true,
    alias: ['trang', 'dem', 'night', 'moonlit'],
    glyphs: '+*.:',
    bg(c, w, h, W) {
      const g = moonGeo(W);
      vgrad(c, w, h, ['#0a1036', '#141c50', '#26306e']);
      const sy = g.sea * W.cell;
      const sea = c.createLinearGradient(0, sy, 0, h);
      sea.addColorStop(0, '#111a4c');
      sea.addColorStop(1, '#070b28');
      c.fillStyle = sea;
      c.fillRect(0, sy, w, h - sy);
      rglow(c, (g.mx + 0.5) * W.cell, (g.my + 0.5) * W.cell, g.mr * W.cell * 5, '#fff2c4', 0.22);
    },
    init(w) {
      const s = w.s;
      const g = moonGeo(w);
      s.stars = [];
      for (let i = Math.round(clamp((w.cols * w.rows) / 70, 15, 160)); i > 0; i--) {
        const x = rint(0, w.cols - 1);
        const y = rint(0, Math.max(0, g.sea - 2));
        if (Math.hypot(x - g.mx, y - g.my) < g.mr + 2) continue;
        s.stars.push({ x, y, ch: pick(['.', '+', '*', ':']), ph: rnd(0, 6), f: rnd(0.6, 2) });
      }
      s.clouds = Array.from({ length: Math.round(clamp(w.cols / 25, 2, 5)) }, () => {
        const c = cloud(w, true, CLOUD_NIGHT);
        c.y = rnd(0, g.sea * 0.6);
        c.v *= 0.4;
        c.a *= 0.75;
        return c;
      });
      s.shoot = null;
      s.next = rnd(2, 6);
    },
    under(w) {
      const g = moonGeo(w);
      for (let dy = -g.mr; dy <= g.mr; dy++) {
        for (let dx = -g.mr; dx <= g.mr; dx++) {
          const d = Math.hypot(dx, dy);
          if (d > g.mr + 0.3) continue;
          const crater = hash(dx, dy, 11) < 0.16 && d < g.mr - 0.8;
          w.tile(g.mx + dx, g.my + dy, crater ? '#eadb9f' : d > g.mr - 0.7 ? '#fff9e3' : '#fff2c7', '#e0cf8e', crater ? 'o' : w.ch(dx, dy, 2));
        }
      }
    },
    frame(w, dt) {
      const s = w.s;
      const g = moonGeo(w);
      for (const st of s.stars) w.glyph(st.x, st.y, st.ch, '#e8ecff', 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(w.t * st.f + st.ph)));
      for (const c of s.clouds) {
        c.x += c.v * dt;
        if (c.x > w.cols + 1) c.x = -c.sp.w - rnd(0, 10);
        w.sprite(c.sp, c.x, c.y, { a: c.a, seed: c.seed });
      }

      s.next -= dt;
      if (!s.shoot && s.next <= 0) s.shoot = { x: rnd(w.cols * 0.3, w.cols), y: rnd(0, g.sea * 0.4), vx: -rnd(16, 24), vy: rnd(6, 10), life: 0 };
      if (s.shoot) {
        const sh = s.shoot;
        sh.life += dt;
        sh.x += sh.vx * dt;
        sh.y += sh.vy * dt;
        const len = Math.hypot(sh.vx, sh.vy);
        for (let i = 0; i < 9; i++) w.tile(sh.x - (sh.vx / len) * i, sh.y - (sh.vy / len) * i, i ? '#cfd8ff' : '#ffffff', '#9fb0ff', '', (1 - i / 9) * (1 - sh.life / 1.4));
        if (sh.life > 1.4 || sh.y > g.sea) {
          s.shoot = null;
          s.next = rnd(4, 10);
        }
      }

      const tick = Math.floor(w.t * 4);
      for (let y = g.sea + 1; y < w.rows; y++) {
        const d = y - g.sea;
        const dir = y % 2 ? 1 : -1;
        for (let x = 0; x < w.cols; x++) {
          if (hash(Math.floor(x + w.t * 0.7 * dir), y, 21) < 0.07) w.glyph(x, y, '~', '#4a57a8', 0.7);
        }
        const spread = 1 + d * 0.7;
        for (let x = Math.floor(g.mx - spread); x <= g.mx + spread; x++) {
          if (hash(x, y, tick) < 0.32) w.tile(x, y, '#fff0b8', '#e2cf86', '~', 0.6 - d * 0.03);
        }
      }
    },
  });

  // Vietnam's flag: 2:3, red field, a yellow five-pointed star in the middle
  // whose centre-to-tip radius is 1/5 of the flag's length, one point up.
  const FLAG_RED = [
    ['#9e1712', '#7f120e'],
    ['#b31b15', '#921611'],
    ['#c72019', '#a51a14'],
    ['#da251d', '#b51f18'],
    ['#e8382c', '#c52c22'],
    ['#f2503f', '#d23e31'],
    ['#fa6a55', '#dc5545'],
  ];
  const FLAG_YELLOW = [
    ['#c7b000', '#9c8900'],
    ['#dac400', '#ac9800'],
    ['#ecd800', '#bda800'],
    ['#ffea00', '#cfb800'],
    ['#fff23d', '#dcc81a'],
    ['#fff76b', '#e4d244'],
    ['#fffa99', '#ebdc6e'],
  ];

  function inStar(x, y, cx, cy, R) {
    const r = R * 0.381966;
    let inside = false;
    for (let k = 0, j = 9; k < 10; j = k++) {
      const ak = -Math.PI / 2 + (k * Math.PI) / 5;
      const aj = -Math.PI / 2 + (j * Math.PI) / 5;
      const rk = k % 2 ? r : R;
      const rj = j % 2 ? r : R;
      const xk = cx + Math.cos(ak) * rk;
      const yk = cy + Math.sin(ak) * rk;
      const xj = cx + Math.cos(aj) * rj;
      const yj = cy + Math.sin(aj) * rj;
      if (yk > y !== yj > y && x < ((xj - xk) * (y - yk)) / (yj - yk) + xk) inside = !inside;
    }
    return inside;
  }

  function flagGeo(w) {
    const horizon = Math.round(w.rows * 0.8);
    const top = Math.max(2, Math.round(w.rows * 0.12));
    // Phones get a bigger share of the width so the star stays readable.
    const narrow = w.cols < 60;
    const L = Math.round(clamp(Math.min(w.cols * (narrow ? 0.55 : 0.34), ((horizon - top - 3) * 3) / 2), 9, 48));
    const H = Math.round((L * 2) / 3);
    const px = Math.round(clamp(narrow ? w.cols - L - 3 : w.cols * 0.62, 2, w.cols - L - 2));
    return { horizon, top, L, H, px };
  }

  // Limestone karst towers (Ha Long style): steep sides, rounded tops.
  function karstHeights(cols, peaks) {
    const hs = new Array(cols).fill(0);
    for (const p of peaks) {
      for (let x = Math.floor(p.x - p.w * 1.3); x <= Math.ceil(p.x + p.w * 1.3); x++) {
        if (x < 0 || x >= cols) continue;
        // Lean: the left and right flanks fall at different rates.
        const dx = x + 0.5 - p.x;
        const d = Math.abs(dx) / (p.w * (dx < 0 ? 1 + p.lean : 1 - p.lean));
        if (d >= 1) continue;
        // Steep flanks, a broad rounded crown.
        hs[x] = Math.max(hs[x], Math.round(p.h * Math.pow(1 - Math.pow(d, 2.6), 0.55)));
      }
    }
    return hs;
  }

  THEMES.push({
    id: 'vn',
    name: 'Việt Nam',
    dark: false,
    veilScale: 0.5,
    alias: ['co', 'co do', 'co viet nam', 'co do sao vang', 'viet nam', 'vietnam', 'quoc ky', 'to quoc', 'flag'],
    glyphs: ':.;',
    bg(c, w, h, W) {
      const g = flagGeo(W);
      const hy = g.horizon * W.cell;
      const sky = c.createLinearGradient(0, 0, 0, hy);
      sky.addColorStop(0, '#4f9fe0');
      sky.addColorStop(0.55, '#9fd2f2');
      sky.addColorStop(1, '#ffe0b0');
      c.fillStyle = sky;
      c.fillRect(0, 0, w, hy);
      const sea = c.createLinearGradient(0, hy, 0, h);
      sea.addColorStop(0, '#6fb7cc');
      sea.addColorStop(1, '#2c7896');
      c.fillStyle = sea;
      c.fillRect(0, hy, w, h - hy);
      rglow(c, w * 0.82, hy, Math.max(w, h) * 0.45, '#ffd27a', 0.55);
    },
    init(w) {
      const s = w.s;
      const g = flagGeo(w);
      s.mask = [];
      for (let j = 0; j < g.H; j++) {
        const row = [];
        for (let i = 0; i < g.L; i++) {
          // Area coverage (6x6 samples per cell) keeps the thin star points from breaking up.
          let n = 0;
          for (let a = 0; a < 6; a++) for (let b = 0; b < 6; b++) if (inStar(i + (a + 0.5) / 6, j + (b + 0.5) / 6, g.L / 2, g.H / 2, g.L / 5)) n++;
          row.push(n / 36 >= 0.22);
        }
        s.mask.push(row);
      }
      const cluster = (n, wMin, wMax, hMax) => {
        const out = [];
        for (let c = 0; c < n; c++) {
          const x = rnd(0, w.cols);
          const h = rnd(hMax * 0.55, hMax);
          const wd = rnd(wMin, wMax);
          out.push({ x, w: wd, h, lean: rnd(-0.25, 0.25) });
          if (Math.random() < 0.7) out.push({ x: x + wd * rnd(0.8, 1.3) * (Math.random() < 0.5 ? -1 : 1), w: wd * 0.7, h: h * rnd(0.45, 0.7), lean: rnd(-0.25, 0.25) });
        }
        return out;
      };
      s.far = cluster(Math.round(clamp(w.cols / 14, 2, 8)), 3, 6, Math.max(4, w.rows * 0.16));
      s.near = cluster(Math.round(clamp(w.cols / 22, 1, 5)), 3.5, 7, Math.max(5, w.rows * 0.24));
      s.clouds = Array.from({ length: Math.round(clamp(w.cols / 30, 2, 5)) }, () => {
        const c = cloud(w, true, CLOUD_DAY);
        c.y = rnd(-1, g.horizon * 0.45);
        c.v *= 0.5;
        return c;
      });
      s.birds = Array.from({ length: Math.round(clamp(w.cols / 14, 3, 9)) }, () => ({ x: rnd(0, w.cols), y: rnd(2, g.horizon * 0.5), v: rnd(0.8, 1.8), ph: rnd(0, 6) }));
      s.dust = Array.from({ length: Math.round(clamp(w.cols / 4, 6, 30)) }, () => ({ x: rnd(w.cols * 0.55, w.cols), y: rnd(0, g.horizon), ph: rnd(0, 6), v: rnd(0.1, 0.4) }));
    },
    under(w) {
      const s = w.s;
      const g = flagGeo(w);
      // Rising sun, half behind the mountains.
      const sx = Math.round(w.cols * 0.82);
      const sr = clamp(Math.round(w.rows * 0.07), 2, 5);
      for (let dy = -sr; dy <= 0; dy++) {
        for (let dx = -sr; dx <= sr; dx++) {
          if (Math.hypot(dx, dy) <= sr + 0.3) w.tile(sx + dx, g.horizon - 1 + dy, '#fff0b8', '#f5d27a', w.ch(dx, dy, 31));
        }
      }
      const far = karstHeights(w.cols, s.far);
      const near = karstHeights(w.cols, s.near);
      // Far towers fade into the morning haze; near ones are darker with green crowns.
      for (let x = 0; x < w.cols; x++) {
        for (let k = 0; k < far[x]; k++) w.tile(x, g.horizon - 1 - k, '#a9c4cf', '#97b5c2', w.ch(x, k, 32), 0.8);
      }
      for (let x = 0; x < w.cols; x++) {
        const hgt = near[x];
        for (let k = 0; k < hgt; k++) {
          const crown = k >= hgt - 2 && hgt > 2;
          w.tile(x, g.horizon - 1 - k, crown ? '#6f9e7c' : '#5b8b92', crown ? '#557f62' : '#46737a', w.ch(x, k, 33));
        }
      }
      // Reflections of the near towers on the water.
      for (let x = 0; x < w.cols; x++) {
        for (let k = 0; k < Math.min(near[x], w.rows - g.horizon) * 0.5; k++) w.tile(x, g.horizon + k, '#3f7f8f', null, '', 0.35 - k * 0.06);
      }
    },
    frame(w, dt) {
      const s = w.s;
      const g = flagGeo(w);
      const t = w.t;

      for (const c of s.clouds) {
        c.x += c.v * dt;
        if (c.x > w.cols + 1) c.x = -c.sp.w - rnd(0, 10);
        w.sprite(c.sp, c.x, c.y, { a: c.a * 0.9, seed: c.seed });
      }
      for (const d of s.dust) w.dot(d.x + Math.sin(t * 0.6 + d.ph), d.y - ((t * d.v) % g.horizon), '#fff4c8', 0.25 + 0.25 * Math.sin(t * 2 + d.ph), 0.22);
      for (const b of s.birds) {
        b.x -= b.v * dt;
        if (b.x < -2) {
          b.x = w.cols + rnd(1, 10);
          b.y = rnd(2, g.horizon * 0.5);
        }
        w.glyph(b.x, b.y + Math.sin(t * 1.3 + b.ph) * 0.6, Math.floor(t * 4 + b.ph) % 2 ? 'v' : '-', '#33475b', 0.85);
      }

      // Water: drifting ripples and the sun's glittering path.
      const tick = Math.floor(t * 4);
      const sx = Math.round(w.cols * 0.82);
      for (let y = g.horizon; y < w.rows; y++) {
        const d = y - g.horizon;
        const dir = y % 2 ? 1 : -1;
        for (let x = 0; x < w.cols; x++) {
          if (hash(Math.floor(x + t * 0.8 * dir), y, 41) < 0.08) w.glyph(x, y, '~', '#e6f6fb', 0.55);
        }
        const spread = 1 + d * 0.8;
        for (let x = Math.floor(sx - spread); x <= sx + spread; x++) {
          if (hash(x, y, tick) < 0.3) w.tile(x, y, '#fff0b8', '#f0d27a', '~', 0.65 - d * 0.03);
        }
      }

      // Flagpole with a gold finial and a stone base.
      for (let y = g.top - 1; y <= g.horizon + 1; y++) w.tile(g.px, y, '#ece6d8', '#bdb5a3', '|');
      w.tile(g.px, g.top - 2, '#ffd34d', '#c99a1c', 'o');
      for (let dx = -1; dx <= 1; dx++) w.tile(g.px + dx, g.horizon + 2, '#8d99a6', '#6d7884', '=');

      // The flag: each column rides a sine wave that grows from the pole to the
      // free end, snapped to whole cells; the slope picks one of seven shades.
      const A = Math.max(1, g.H * 0.14);
      const k = (Math.PI * 2.2) / g.L;
      for (let i = 0; i < g.L; i++) {
        const f = Math.pow((i + 1) / g.L, 0.8);
        const ph = i * k - t * 3.4;
        const dy = Math.round((Math.sin(ph) + 0.18 * Math.sin(ph * 2.1 + 1)) * A * f);
        const shade = clamp(Math.round(Math.cos(ph) * (0.6 + f) * 2), -3, 3) + 3;
        const x = g.px + 1 + i;
        for (let j = 0; j < g.H; j++) {
          const star = s.mask[j] && s.mask[j][i];
          const p = (star ? FLAG_YELLOW : FLAG_RED)[shade];
          w.tile(x, g.top + j + dy, p[0], p[1], star ? '*' : w.ch(i, j, 34));
        }
      }
    },
  });


  /* --- Sakura Breeze (Kyoto Spring, Mt. Fuji & Torii) --- */
  const TORII_GATE = sprite(
    [
      '  mmmmmmmmmmmmmm  ',
      ' mMMMMMMMMMMMMMMm ',
      '   r   r    r   r ',
      '   rrrrrrrrrrrrrr ',
      '   R            R ',
      '   R            R ',
      '   R            R ',
      '   R            R ',
      '  bbb          bbb',
    ],
    {
      m: ['#7f1d1d', '#450a0a', '='],
      M: ['#dc2626', '#991b1b', '#'],
      r: ['#ef4444', '#b91c1c', '-'],
      R: ['#dc2626', '#991b1b', '|'],
      b: ['#475569', '#334155', 'b'],
    },
  );

  const SAKURA_BRANCH_BIG = sprite(
    [
      '                                              bbbbbbbbbbbbbb',
      '                                      bbbbbbbbb       bbbbbb',
      '                              kkkkkkbbb                 bbbb',
      '                     FffF       bbkkk   FffF                ',
      '             FffF   fpccpf   kkk    k  fpccpf    FffF       ',
      '            fpccpf   FffF   k      k    FffF    fpccpf      ',
      '        l    FffF         kk      k              FffF       ',
      '      FffF         FffF  k       k     FffF                 ',
      '     fpccpf   l   fpccpf        k     fpccpf    l    d      ',
      '      FffF         FffF                FffF          d      ',
      '                                                     L      ',
      '                                                    lGl     ',
      '                                                     L      ',
    ],
    {
      b: ['#3e2723', '#241411', '#'],
      k: ['#5d4037', '#3e2723', '='],
      f: ['#ffb7c5', '#ffffff', '*'],
      F: ['#f472b6', '#fff1f2', '+'],
      p: ['#fce7f3', '#f472b6', '°'],
      c: ['#e11d48', '#ffffff', 'o'],
      l: ['#86efac', '#15803d', ':'],
      d: ['#1e293b', null, '|'],
      L: ['#b91c1c', '#7f1d1d', '='],
      G: ['#fef08a', '#f59e0b', '*'],
    },
  );

  function fujiHeights(cols, fx, fw, fh) {
    const hs = new Array(cols).fill(0);
    const halfW = fw / 2;
    for (let x = Math.floor(fx - halfW); x <= Math.ceil(fx + halfW); x++) {
      if (x < 0 || x >= cols) continue;
      const u = Math.abs(x + 0.5 - fx) / halfW;
      if (u >= 1) continue;
      let h = fh * Math.pow(1 - Math.pow(u, 1.35), 1.75);
      if (u < 0.1) h *= 0.96;
      hs[x] = Math.round(h);
    }
    return hs;
  }

  function spawnSakuraPetal(w, randomY, fromBranch, isFar) {
    const C = w.cols;
    const R = w.rows;
    const bx = Math.max(0, C - SAKURA_BRANCH_BIG.w);
    const startX = fromBranch ? rnd(bx + 10, C) : rnd(-4, C + 4);
    const startY = fromBranch ? rnd(0, SAKURA_BRANCH_BIG.h) : randomY ? rnd(-5, R + 2) : rnd(-8, -1);
    const z = isFar ? rnd(0.4, 0.6) : rnd(0.8, 1.25);
    return {
      x: startX,
      y: startY,
      vx: rnd(0.8, 1.8) * z,
      vy: rnd(0.6, 1.5) * z,
      swayAmp: rnd(0.7, 2.2),
      swayFreq: rnd(1.2, 2.6),
      ph: rnd(0, Math.PI * 2),
      rot: rnd(0, 6.28),
      rotSpeed: rnd(-2.5, 2.5),
      ch: pick(['*', '+', '°', '.', 'o']),
      bg: isFar ? pick(['#fce7f3', '#fbcfe8', '#fda4af']) : pick(['#ffb7c5', '#fbcfe8', '#fda4af', '#fce7f3', '#f472b6']),
      fg: pick(['#ffffff', '#fff1f2', '#fce7f3']),
      a: isFar ? rnd(0.45, 0.7) : rnd(0.75, 0.98),
      z,
      isFar,
    };
  }

  THEMES.push({
    id: 'sakura',
    name: 'Sakura Breeze',
    dark: false,
    veilScale: 0.55,
    alias: ['sakura', 'hoa', 'anhdao', 'cherry', 'kyoto', 'japan', 'fuji', 'phu si', 'torii'],
    glyphs: '*+:.o~°',
    bg(c, w, h, W) {
      const hy = Math.round(W.rows * 0.76) * W.cell;
      // Spring morning sky with pastel twilight
      const sky = c.createLinearGradient(0, 0, 0, hy);
      sky.addColorStop(0, '#fce7f3');
      sky.addColorStop(0.4, '#fed7aa');
      sky.addColorStop(0.75, '#fef3c7');
      sky.addColorStop(1, '#ffedd5');
      c.fillStyle = sky;
      c.fillRect(0, 0, w, hy);

      // Lake reflection
      const lake = c.createLinearGradient(0, hy, 0, h);
      lake.addColorStop(0, '#fbcfe8');
      lake.addColorStop(0.2, '#93c5fd');
      lake.addColorStop(1, '#2563eb');
      c.fillStyle = lake;
      c.fillRect(0, hy, w, h - hy);

      // Rising Sun glow near Mt. Fuji
      rglow(c, w * 0.32, hy * 0.9, Math.max(w, h) * 0.45, '#fb7185', 0.45);
      // Soft warmth from cherry branch canopy
      rglow(c, w * 0.85, hy * 0.2, Math.max(w, h) * 0.5, '#f472b6', 0.28);
    },
    under(w) {
      const hy = Math.round(w.rows * 0.76);
      const fx = Math.round(w.cols * (w.cols < 60 ? 0.42 : 0.28));
      const fw = Math.round(clamp(w.cols * 0.52, 22, 54));
      const fh = Math.round(clamp(w.rows * 0.36, 10, 24));
      const fujiH = fujiHeights(w.cols, fx, fw, fh);

      // Draw Mt. Fuji
      for (let x = 0; x < w.cols; x++) {
        const h = fujiH[x];
        if (h <= 0) continue;
        for (let y = hy - h; y < hy; y++) {
          const elev = hy - y;
          const isSnow = elev > h * 0.62 || (elev > h * 0.46 && hash(x, y, 7) < 0.38);
          if (isSnow) {
            w.tile(x, y, '#ffffff', '#e2e8f0', '*', 0.96);
          } else {
            const dx = x - fx;
            if (dx < 0) w.tile(x, y, '#818cf8', '#c7d2fe', '/', 0.88);
            else w.tile(x, y, '#4338ca', '#312e81', '\\', 0.92);
          }
        }
        // Lake reflection of Mt. Fuji
        const refH = Math.min(Math.round(h * 0.45), w.rows - hy);
        for (let k = 0; k < refH; k++) {
          w.tile(x, hy + k, '#3b82f6', null, '', 0.28 - k * 0.05);
        }
      }

      // Torii Gate on water edge
      const tx = Math.round(clamp(w.cols * (w.cols < 60 ? 0.05 : 0.12), 1, Math.max(2, w.cols - TORII_GATE.w - 2)));
      const ty = hy - TORII_GATE.h + 2;
      w.sprite(TORII_GATE, tx, ty);

      // Lush Sakura Branch canopy at top-right
      const bx = Math.max(0, w.cols - SAKURA_BRANCH_BIG.w);
      w.sprite(SAKURA_BRANCH_BIG, bx, 0);

      if (w.cols > 50) {
        w.tile(bx - 3, 3, '#f472b6', '#ffffff', '*');
        w.tile(bx - 5, 4, '#ffb7c5', '#fff1f2', '+');
        w.tile(bx - 2, 5, '#e11d48', '#ffffff', 'o');
        w.tile(bx - 6, 2, '#86efac', '#15803d', ':');
      }

      // Fallen petals on the water shore
      for (let x = 0; x < w.cols; x += rint(3, 8)) {
        w.tile(x, w.rows - 1, '#fce7f3', '#f472b6', pick(['*', '+', '°']), 0.65);
      }
    },
    init(w) {
      const s = w.s;
      const count = Math.round(clamp((w.cols * w.rows) / 18, 35, 110) * (cfg.density || 1.0));
      s.petals = Array.from({ length: count }, (_, i) => spawnSakuraPetal(w, true, false, i % 3 === 0));
      s.gustTimer = rnd(4, 8);
      s.gustActive = false;
      s.gustDuration = 0;
      s.gustStrength = 0;
      s.birds = Array.from({ length: Math.round(clamp(w.cols / 18, 2, 6)) }, () => ({
        x: rnd(0, w.cols),
        y: rnd(2, w.rows * 0.35),
        v: rnd(1.0, 2.0),
        ph: rnd(0, 6),
      }));
    },
    frame(w, dt) {
      const s = w.s;
      const speedMul = cfg.speed || 1.0;
      const hy = Math.round(w.rows * 0.76);
      const t = w.t;

      // Hanging lantern subtle sway & warm glow
      const bx = Math.max(0, w.cols - SAKURA_BRANCH_BIG.w);
      const lx = bx + 52;
      const ly = 12;
      w.glow(lx, ly, 7, '#fef08a', 0.55 + 0.15 * Math.sin(t * 3));

      // Birds flying over Mt. Fuji
      for (const b of s.birds) {
        b.x -= b.v * dt * speedMul;
        if (b.x < -3) {
          b.x = w.cols + rnd(2, 10);
          b.y = rnd(2, hy * 0.45);
        }
        w.glyph(b.x, b.y + Math.sin(t * 1.6 + b.ph) * 0.5, Math.floor(t * 4 + b.ph) % 2 ? 'v' : '^', '#334155', 0.85);
      }

      // Wind gust logic
      s.gustTimer -= dt;
      if (s.gustTimer <= 0 && !s.gustActive) {
        s.gustActive = true;
        s.gustDuration = rnd(2.0, 3.2);
        s.gustStrength = rnd(2.8, 4.5);
        s.gustTimer = rnd(6, 12);
        const burst = rint(14, 24);
        for (let k = 0; k < burst; k++) {
          s.petals.push(spawnSakuraPetal(w, false, true, Math.random() < 0.3));
        }
      }

      let currentWind = 1;
      if (s.gustActive) {
        s.gustDuration -= dt;
        if (s.gustDuration <= 0) s.gustActive = false;
        else currentWind = 1 + s.gustStrength * Math.sin((s.gustDuration / 3.0) * Math.PI);
      }

      const totalSpeed = speedMul * currentWind;
      const mouse = w.mouse;
      const hasMouse = mouse && mouse.active;

      // Lake ripples
      for (let y = hy; y < w.rows; y++) {
        const dir = y % 2 ? 1 : -1;
        for (let x = 0; x < w.cols; x += 3) {
          if (hash(Math.floor(x + t * 0.7 * dir), y, 31) < 0.09) {
            w.glyph(x, y, '~', '#fbcfe8', 0.5);
          }
        }
      }

      // Parallax Petals
      const maxPetals = Math.round(clamp((w.cols * w.rows) / 14, 50, 150) * (cfg.density || 1.0));
      if (s.petals.length > maxPetals) s.petals.splice(0, s.petals.length - maxPetals);

      for (let i = 0; i < s.petals.length; i++) {
        const p = s.petals[i];
        p.ph += dt * p.swayFreq * (s.gustActive ? 2.0 : 1.0);
        const sway = Math.sin(p.ph) * p.swayAmp;

        p.x -= (p.vx * totalSpeed + sway * 0.4) * dt;
        p.y += (p.vy * totalSpeed * 0.75 + Math.abs(sway) * 0.25) * dt;
        p.rot += p.rotSpeed * dt * totalSpeed;

        if (hasMouse) {
          const dx = p.x - mouse.x;
          const dy = p.y - mouse.y;
          const dist = Math.hypot(dx, dy);
          if (dist < 12) {
            const force = (1 - dist / 12) * 9 * dt;
            p.x += (dx / (dist + 0.1)) * force + mouse.vx * 0.45 * dt;
            p.y += (dy / (dist + 0.1)) * force + mouse.vy * 0.45 * dt;
            p.rot += 14 * dt;
          }
        }

        if (p.x < -4 || p.y > w.rows + 1) {
          s.petals[i] = spawnSakuraPetal(w, false, Math.random() < 0.65, p.isFar);
          continue;
        }

        const char = Math.cos(p.rot) > 0.2 ? p.ch : Math.cos(p.rot) < -0.2 ? '+' : '°';
        w.tile(p.x, p.y, p.bg, p.fg, char, p.a * p.z);
      }

      if (s.gustActive) {
        for (let k = 0; k < 5; k++) {
          const wx = Math.round(w.cols - ((t * 40 + k * 18) % (w.cols + 24)));
          const wy = Math.round(2 + (k * 4) % (w.rows - 6));
          w.glyph(wx, wy, '~', '#ffffff', 0.45);
          w.glyph(wx + 1, wy, '~', '#fda4af', 0.35);
        }
      }
    },
  });

  // Light leaking in from the edges, one color per scene.
  const TINTS = { cloud: '#ffffff', lagoon: '#7ff0ff', koi: '#8be3a6', jelly: '#b49cff', boats: '#bff3ff', fireflies: '#d9ff6e', moon: '#8fa8ff', vn: '#ffd34d', sakura: '#ff9fcb' };
  for (const t of THEMES) if (!t.tint) t.tint = TINTS[t.id] || '#ffffff';

  const ITEMS = THEMES.map((t) => t.id).concat('off');
  const byId = (id) => THEMES.find((t) => t.id === id);

  /* --------------------------------------------------------------- settings */

  const KEY = 'pixel-themes:v1';
  const cfg = { theme: 'cloud', veil: 0.2, glass: 0.72, motion: true, button: true, density: 1.0, speed: 1.0, autoCycle: false, bot: true, crisp: true, calm: false };
  try {
    Object.assign(cfg, JSON.parse(localStorage.getItem(KEY) || '{}'));
  } catch (e) {
    /* storage blocked: keep defaults */
  }
  if (!ITEMS.includes(cfg.theme)) cfg.theme = 'cloud';
  const save = () => {
    try {
      localStorage.setItem(KEY, JSON.stringify(cfg));
    } catch (e) {
      /* ignore */
    }
  };

  /* ----------------------------------------------------------------- styles */

  const PAGE_CSS = `
html[data-pxt-on], html[data-pxt-on] body { background-color: transparent !important; background-image: none !important; }
html[data-pxt-on] [data-pxt="clear"] { background-color: transparent !important; background-image: none !important; }
html[data-pxt-on] [data-pxt="glass"] {
  background-color: rgba(var(--pxt-card), var(--pxt-alpha, .72)) !important;
  background-image: none !important;
  -webkit-backdrop-filter: blur(var(--pxt-blur, 0px));
  backdrop-filter: blur(var(--pxt-blur, 0px));
}

/* ---- Readable text: a thin contrasting halo instead of a fog over the wallpaper ---- */
html[data-pxt-on][data-pxt-crisp] body {
  text-shadow: 0 0 2px rgba(var(--pxt-halo), .95), 0 1px 5px rgba(var(--pxt-halo), .6);
}
html[data-pxt-on][data-pxt-crisp] :is(pre, code, kbd, textarea, input, select, svg, canvas, img, [contenteditable], [contenteditable] *) { text-shadow: none; }
html[data-pxt-on][data-pxt-flip="light-text"] body :not(pre *, [data-pxt-ui], [data-pxt-ui] *) { color: #f3f1ec !important; caret-color: #f3f1ec; }
html[data-pxt-on][data-pxt-flip="light-text"] body :is([contenteditable], textarea, input)::placeholder { color: rgba(243, 241, 236, .55) !important; }
html[data-pxt-on][data-pxt-flip="dark-text"] body :not(pre *, [data-pxt-ui], [data-pxt-ui] *) { color: #1f1d1a !important; caret-color: #1f1d1a; }
/* Gradient-filled words (the shimmering "thinking" line) keep the app's own dark or light
   gradient, so in a flipped scene they get the plain text color instead. */
html[data-pxt-on][data-pxt-flip] body :not(pre *, [data-pxt-ui], [data-pxt-ui] *) { -webkit-text-fill-color: currentColor !important; }
html[data-pxt-on][data-pxt-flip="light-text"] body :not(pre *, [data-pxt-ui], [data-pxt-ui] *)::before,
html[data-pxt-on][data-pxt-flip="light-text"] body :not(pre *, [data-pxt-ui], [data-pxt-ui] *)::after { color: #f3f1ec !important; -webkit-text-fill-color: currentColor !important; }
html[data-pxt-on][data-pxt-flip="dark-text"] body :not(pre *, [data-pxt-ui], [data-pxt-ui] *)::before,
html[data-pxt-on][data-pxt-flip="dark-text"] body :not(pre *, [data-pxt-ui], [data-pxt-ui] *)::after { color: #1f1d1a !important; -webkit-text-fill-color: currentColor !important; }
html[data-pxt-on][data-pxt-flip] [data-pxt="glass"] { background-color: rgba(var(--pxt-card), var(--pxt-alpha, .72)) !important; }

html[data-pxt-on][data-pxt-flip] [data-pxt="chip"] {
  background-color: color-mix(in srgb, rgb(var(--pxt-card)) 84%, rgb(var(--pxt-edge))) !important;
  background-image: none !important;
  text-shadow: none !important;
}
html[data-pxt-on][data-pxt-flip] body :is(input:not([type="checkbox"], [type="radio"], [type="range"], [type="color"], [type="file"]), select, textarea):not([data-pxt-ui] *) {
  background-color: color-mix(in srgb, rgb(var(--pxt-card)) 84%, rgb(var(--pxt-edge))) !important;
}
html[data-pxt-on][data-pxt-flip] body :not(pre) > code { background-color: rgba(var(--pxt-edge), .12) !important; }

/* ---- Menus, "/" command list, dropdowns, tooltips: a near-solid card, never see-through ---- */
html[data-pxt-on] [data-pxt="pop"] {
  background-color: rgb(var(--pxt-card)) !important;
  background-image: none !important;
  -webkit-backdrop-filter: none !important;
  backdrop-filter: none !important;
  box-shadow: 0 0 0 1px rgba(var(--pxt-edge), .14), 0 10px 28px rgba(0, 0, 0, .35) !important;
  text-shadow: none !important;
}
/* One card per popup: anything of ours nested inside a painted popup stays flat. */
html[data-pxt-on] [data-pxt-menu] [data-pxt="pop"],
html[data-pxt-on] [data-pxt="pop"] [data-pxt="pop"] {
  background-color: transparent !important;
  box-shadow: none !important;
}
html[data-pxt-on] :is([data-pxt="pop"], [data-pxt-menu]) * { text-shadow: none !important; }
html[data-pxt-on] [data-pxt="pop"] [data-pxt="clear"] { box-shadow: none !important; }

/* ---- Message bubbles and code cards get a solid card (claude.ai + Desktop Code tab) ---- */
html[data-pxt-on][data-pxt-crisp] :is([class~="group/bubble"], [data-testid="user-message"]) {
  background: rgba(var(--pxt-card), .9) !important;
  box-shadow: 0 0 0 1px rgba(var(--pxt-edge), .12), 0 8px 24px rgba(0, 0, 0, .22) !important;
  text-shadow: none;
}
/* One card per bubble: wrappers nested inside a bubble stay flat. */
html[data-pxt-on] body :is([class~="group/bubble"], [data-testid="user-message"]) :is([class~="group/bubble"], [data-testid="user-message"], [data-pxt="glass"], [data-pxt="pop"], [data-pxt="clear"]) {
  background: transparent !important;
  box-shadow: none !important;
}
html[data-pxt-on][data-pxt-crisp] :is(.epitaxy-code-card, .epitaxy-diff, pre) {
  background-color: rgba(var(--pxt-card), .92) !important;
  text-shadow: none;
}

/* ---- Desktop Code tab: drop the square bands behind the prompt, card the prompt itself ---- */
html[data-pxt-on] [class~="group/approval-dock"],
html[data-pxt-on] [class*="epitaxy-transcript-surface"][class~="sticky"],
html[data-pxt-on] [class*="epitaxy-transcript-surface"][class~="absolute"] {
  background: transparent !important;
  -webkit-backdrop-filter: none !important;
  backdrop-filter: none !important;
  box-shadow: none !important;
}
html[data-pxt-on] .epitaxy-prompt [class~="bg-surface-3"],
html[data-pxt-on] fieldset:has([contenteditable="true"]) > div:first-child {
  background: rgba(var(--pxt-card), .94) !important;
  -webkit-backdrop-filter: none !important;
  backdrop-filter: none !important;
  box-shadow: 0 0 0 1px rgba(var(--pxt-edge), .14), 0 10px 30px rgba(0, 0, 0, .25) !important;
  border-radius: 14px !important;
  text-shadow: none;
}
canvas[data-pxt-ui="bg"] { position: fixed !important; top: 0 !important; left: 0 !important; width: 100% !important; height: 100% !important; z-index: -1 !important; pointer-events: none !important; display: none; }
html[data-pxt-on] canvas[data-pxt-ui="bg"] { display: block !important; }
`;

  const UI_CSS = `
:host { all: initial; }
* { box-sizing: border-box; }
[hidden] { display: none !important; }
.fab {
  position: fixed; right: 12px; top: 50%; transform: translateY(-50%); z-index: 2147483000;
  width: 36px; height: 36px; padding: 0; border-radius: 10px; cursor: pointer;
  border: 1px solid rgba(255,255,255,.4); background: rgba(24,24,28,.35);
  -webkit-backdrop-filter: blur(8px); backdrop-filter: blur(8px);
  display: grid; grid-template-columns: repeat(3, 6px); grid-auto-rows: 6px; gap: 2px; place-content: center;
  opacity: .6; transition: opacity .2s;
}
.fab:hover, .fab:focus-visible { opacity: 1; }
.fab i { display: block; border-radius: 1.5px; }
.panel {
  position: fixed; left: 50%; transform: translateX(-50%); z-index: 2147483001;
  width: min(760px, calc(100vw - 20px)); padding: 10px 10px 8px; border-radius: 14px;
  color: #1d1d1f; background: rgba(255,255,255,.88); border: 1px solid rgba(0,0,0,.08);
  box-shadow: 0 12px 40px rgba(0,0,0,.2);
  -webkit-backdrop-filter: blur(18px) saturate(1.4); backdrop-filter: blur(18px) saturate(1.4);
  font: 12px/1.35 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
}
.panel.dark { color: #f2f2f2; background: rgba(30,30,32,.88); border-color: rgba(255,255,255,.1); }
.hd { display: flex; align-items: center; gap: 10px; padding: 0 4px 8px; }
.cmd { font: 600 11px/1 ui-monospace, Menlo, Consolas, monospace; padding: 4px 6px; border-radius: 5px; background: rgba(127,127,127,.18); }
.ttl { opacity: .7; }
.hint { margin-left: auto; opacity: .55; font-size: 11px; white-space: nowrap; }
.note { padding: 0 4px 6px; font-size: 11px; opacity: .7; }
.list { position: relative; display: flex; flex-wrap: wrap; gap: 10px 8px; max-height: min(52vh, 420px); overflow-y: auto; padding: 3px 3px 8px; scrollbar-width: thin; }
.it { flex: 0 0 auto; width: 84px; padding: 0; border: 0; background: none; color: inherit; font: inherit; text-align: left; cursor: pointer; }
.th { display: block; width: 84px; height: 54px; border-radius: 8px; overflow: hidden; outline: 2px solid transparent; outline-offset: 1px; background: rgba(127,127,127,.2); }
.th canvas { display: block; width: 100%; height: 100%; }
.it:hover .th { outline-color: rgba(47,124,246,.45); }
.it.sel .th { outline-color: #2f7cf6; }
.nm { display: block; margin-top: 4px; font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.it.cur .nm::after { content: " \\2713"; color: #2f7cf6; }
.off { display: grid; place-items: center; height: 100%; font-weight: 600; letter-spacing: .08em; opacity: .7;
  background: repeating-linear-gradient(45deg, rgba(127,127,127,.22) 0 6px, transparent 6px 12px); }
.ctl { display: flex; flex-wrap: wrap; gap: 6px 16px; align-items: center; padding: 8px 4px 0; border-top: 1px solid rgba(127,127,127,.2); }
.ctl label { display: flex; align-items: center; gap: 6px; font-size: 11px; opacity: .85; cursor: pointer; }
.ctl input[type=range] { width: 96px; accent-color: #2f7cf6; }
.ctl input[type=checkbox] { accent-color: #2f7cf6; }
@media (pointer: coarse) {
  .hint { display: none; }
  .fab { width: 42px; height: 42px; grid-template-columns: repeat(3, 7px); grid-auto-rows: 7px; }
  .it, .th { width: 92px; }
  .th { height: 60px; }
  .ctl input[type=range] { width: 120px; }
}
`;

  function sheet(css, target) {
    try {
      const s = new CSSStyleSheet();
      s.replaceSync(css);
      target.adoptedStyleSheets = [...target.adoptedStyleSheets, s];
      return;
    } catch (e) {
      /* older browser: fall back to a <style> element */
    }
    const el = document.createElement('style');
    el.textContent = css;
    (target === document ? document.head || document.documentElement : target).appendChild(el);
  }

  /* ---------------------------------------------------- background scanner */

  const probe = document.createElement('canvas');
  probe.width = probe.height = 1;
  const pctx = probe.getContext('2d', { willReadFrequently: true });
  const colors = new Map();

  // Any CSS color (rgb, hsl, oklch, ...) -> {r, g, b, a}.
  function toRGBA(s) {
    if (!s || s === 'transparent') return null;
    if (colors.has(s)) return colors.get(s);
    let v = null;
    const m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:\s*[,/]\s*([\d.]+)(%?))?\s*\)$/.exec(s);
    if (m) {
      v = { r: +m[1], g: +m[2], b: +m[3], a: m[4] == null ? 1 : m[5] ? m[4] / 100 : +m[4] };
    } else {
      pctx.fillStyle = '#010203';
      pctx.fillStyle = s;
      if (pctx.fillStyle !== '#010203') {
        pctx.clearRect(0, 0, 1, 1);
        pctx.fillRect(0, 0, 1, 1);
        const d = pctx.getImageData(0, 0, 1, 1).data;
        v = { r: d[0], g: d[1], b: d[2], a: d[3] / 255 };
      }
    }
    if (colors.size > 500) colors.clear();
    colors.set(s, v);
    return v;
  }

  const lum = (c) => (0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b) / 255;

  // Saturated colors are buttons / badges: leave them alone.
  function accent(c) {
    const r = c.r / 255;
    const g = c.g / 255;
    const b = c.b / 255;
    const mx = Math.max(r, g, b);
    const mn = Math.min(r, g, b);
    const l = (mx + mn) / 2;
    const d = mx - mn;
    const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
    return s > 0.4 && l > 0.18 && l < 0.85;
  }

  const SKIP = /^(IMG|VIDEO|CANVAS|SVG|IFRAME|PICTURE|INPUT|SELECT|OPTION|SCRIPT|STYLE|LINK|META|HEAD|BR|HR|PATH|G|USE|HTML|BODY)$/i;
  const UI_SEL = 'button, a, label, [role="button"], [role="menuitem"], [role="option"], [role="tab"]';
  const OVERLAY_SEL = 'dialog, [role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"], [aria-modal="true"], [data-radix-popper-content-wrapper]';

  const BUBBLE_SEL = '[class~="group/bubble"], [data-testid="user-message"]';
  const glassColor = new WeakMap();

  function mark(el, kind, c) {
    if (kind === 'glass') {
      glassColor.set(el, c);
      el.style.setProperty('--pxt-rgb', `${Math.round(c.r)}, ${Math.round(c.g)}, ${Math.round(c.b)}`);
    }
    el.setAttribute('data-pxt', kind);
  }

  // Buttons, file cards and badges keep the app's own color. That is right until our text
  // flip turns their words light on a light box, so they are tagged and recolored only then.
  function chip(el) {
    if (el.textContent.trim() || el.querySelector('svg')) return mark(el, 'chip');
    // No words of its own: the sliding pill behind the selected tab of a segmented control.
    // Thin lines, dots and switch knobs stay as they are.
    const r = el.getBoundingClientRect();
    if (r.width >= 28 && r.height >= 18 && r.width >= r.height * 1.3) mark(el, 'chip');
  }

  function classify(el, vw, vh, area) {
    if (el.nodeType !== 1 || el.hasAttribute('data-pxt') || el.hasAttribute('data-pxt-ui') || SKIP.test(el.tagName)) return;
    const cs = getComputedStyle(el);
    // Inline boxes (code chips, highlights) keep their look: a blurred inline box
    // that wraps across lines would blur the text next to it.
    if (cs.display === 'none' || cs.display === 'inline' || cs.display === 'contents' || cs.visibility === 'hidden') return;
    const img = cs.backgroundImage;
    const grad = img !== 'none' && /gradient/.test(img);
    if (img !== 'none' && !grad) return;
    // Shimmering "thinking" text is a gradient clipped to the letters: leave it alone.
    if ((cs.webkitBackgroundClip || cs.backgroundClip || '').includes('text')) return;
    // Inside a chat bubble only the bubble itself is a card: inner wrappers go flat.
    if (el.parentElement && el.parentElement.closest(BUBBLE_SEL)) {
      const c0 = toRGBA(cs.backgroundColor);
      if (c0 && c0.a > 0.04 && !accent(c0)) {
        if (el.matches(UI_SEL)) chip(el);
        else if (!el.matches('pre, code, kbd, .epitaxy-code-card, .epitaxy-diff')) mark(el, 'clear');
      }
      return;
    }
    const c = toRGBA(cs.backgroundColor);
    const solid = c && c.a >= 0.6;
    const tinted = c && c.a > 0.04;
    const frosted = !!cs.backdropFilter && cs.backdropFilter !== 'none';
    if (!solid && !grad && !tinted && !frosted) return;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return;
    const ratio = (Math.min(r.width, vw) * Math.min(r.height, vh)) / area;
    const ui = el.matches(UI_SEL);
    // Drawers, popovers and modals float above other content, so they need glass, not a hole.
    const overlay = !!el.closest(OVERLAY_SEL);
    const floating = overlay || ((cs.position === 'fixed' || cs.position === 'absolute') && cs.zIndex !== 'auto' && ratio < 0.95);

    // Menus and popups (the "/" command list, dropdowns, tooltips) sit on top of
    // the transcript: give them a near-solid card so the chat behind never shows through.
    const bar = r.height < 64 && r.width > vw * 0.6;
    const panelLike = r.height < vh * 0.85 && ratio < 0.5 && !bar;
    // A panel that sticks out of the card it lives in (the "/" list rises above the
    // prompt box) is a popup, not a same-colored wrapper.
    const host = el.parentElement && el.parentElement.closest('[data-pxt="glass"], [data-pxt="pop"]');
    const hb = host && host.getBoundingClientRect();
    const popsOut = !!hb && panelLike && (r.top < hb.top - 6 || r.bottom > hb.bottom + 6 || r.left < hb.left - 6 || r.right > hb.right + 6);
    // Rows and chips inside a popup are not popups themselves.
    const tall = r.height >= 44 && !el.closest('[data-pxt-menu]');
    if ((overlay || ((popsOut || (floating && panelLike) || (frosted && !solid && panelLike)) && tall)) && ratio >= 0.0015 && !(ui && ratio < 0.03)) {
      const outer = !popsOut && host && host.getAttribute('data-pxt') === 'pop' ? host : null;
      if (outer) {
        // Inside a menu: drop same-colored wrappers, keep row highlights and chips as they are.
        const o = glassColor.get(outer);
        if (solid && (!o || o.a < 0.04 || Math.abs(o.r - c.r) + Math.abs(o.g - c.g) + Math.abs(o.b - c.b) < 24)) mark(el, 'clear');
        else if (solid && !accent(c)) chip(el);
        return;
      }
      glassColor.set(el, c || { r: 0, g: 0, b: 0, a: 0 });
      return mark(el, 'pop');
    }
    if (!solid && !grad) return;

    if (ratio >= 0.4 && !floating) return mark(el, 'clear');
    if (!solid) {
      // Fade gradients (e.g. above the composer) would paint a band of solid color.
      if (!ui && ratio >= 0.02) mark(el, 'clear');
      return;
    }
    if (accent(c)) return;
    if (ratio < 0.0015 || (ui && ratio < 0.03)) return chip(el);
    const outer = el.parentElement && el.parentElement.closest('[data-pxt="glass"]');
    if (outer) {
      // Same-colored wrapper inside a glass panel: drop it so the alpha doesn't stack.
      const o = glassColor.get(outer);
      if (!o || Math.abs(o.r - c.r) + Math.abs(o.g - c.g) + Math.abs(o.b - c.b) < 24) return mark(el, 'clear');
      if (ratio < 0.02) return chip(el);
    }
    mark(el, 'glass', c);
  }

  // The veil and the picker follow the page's light/dark mode, read from its text color.
  function computeDark() {
    // Read the app's own colors, not the ones our text flip forces.
    const flip = root.getAttribute('data-pxt-flip');
    if (!flip) return computeDarkRaw();
    root.removeAttribute('data-pxt-flip');
    try {
      return computeDarkRaw();
    } finally {
      root.setAttribute('data-pxt-flip', flip);
    }
  }

  function computeDarkRaw() {
    const els =document.body ? document.body.querySelectorAll('p, li, h1, h2, h3, button, a') : [];
    let n = 0;
    let light = 0;
    for (const el of els) {
      if (n >= 24) break;
      if (!el.textContent.trim()) continue;
      const c = toRGBA(getComputedStyle(el).color);
      if (!c || c.a < 0.3) continue;
      n++;
      if (lum(c) > 0.55) light++;
    }
    if (!n) {
      const c = document.body && toRGBA(getComputedStyle(document.body).color);
      return c ? lum(c) > 0.55 : matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return light / n > 0.5;
  }

  let darkDirty = true;
  let darkAt = 0;
  let scanning = false;
  let sampleTimer = 0;
  let flushTimer = 0;
  const deepQ = new Set();
  const shallowQ = new Set();

  const mo = new MutationObserver((list) => {
    for (const m of list) {
      if (m.type === 'childList') {
        for (const n of m.addedNodes) if (n.nodeType === 1) deepQ.add(n);
      } else if (m.target.nodeType === 1) {
        const k = m.target.getAttribute('data-pxt');
        if (k === 'chip') m.target.removeAttribute('data-pxt');
        if (!k || k === 'chip') shallowQ.add(m.target);
      }
    }
    if (!flushTimer) flushTimer = setTimeout(flush, 250);
    menuLater();
  });

  function flush() {
    flushTimer = 0;
    const vw = innerWidth;
    const vh = innerHeight;
    const area = vw * vh;
    let budget = 3000;
    for (const el of deepQ) {
      if (!el.isConnected) continue;
      classify(el, vw, vh, area);
      const all = el.getElementsByTagName('*');
      for (let i = 0; i < all.length && budget > 0; i++, budget--) classify(all[i], vw, vh, area);
    }
    for (const el of shallowQ) {
      if (!el.isConnected) continue;
      classify(el, vw, vh, area);
      // The state often sits on the button while the color sits on a child.
      const kids = el.children;
      for (let i = 0; i < kids.length && i < 12; i++) classify(kids[i], vw, vh, area);
    }
    deepQ.clear();
    shallowQ.clear();
  }

  function fullScan() {
    const all = document.body.getElementsByTagName('*');
    const vw = innerWidth;
    const vh = innerHeight;
    const area = vw * vh;
    let i = 0;
    (function chunk() {
      if (!scanning) return;
      const end = Math.min(all.length, i + 600);
      for (; i < end; i++) classify(all[i], vw, vh, area);
      if (i < all.length && i < 20000) setTimeout(chunk, 16);
    })();
  }

  // Catches elements that were hidden during the first scan and shown later.
  function sample() {
    if (document.hidden) return;
    const vw = innerWidth;
    const vh = innerHeight;
    const area = vw * vh;
    const seen = new Set();
    for (let i = 1; i < 7; i++) {
      for (let j = 1; j < 9; j++) {
        const stack = document.elementsFromPoint((i / 7) * vw, (j / 9) * vh);
        for (let k = stack.length - 1; k >= 0; k--) {
          if (seen.has(stack[k])) continue;
          seen.add(stack[k]);
          classify(stack[k], vw, vh, area);
        }
      }
    }
    // While our text flip is on, measuring the app's own colors means switching the flip off
    // and on again, which restyles the whole page. Only do that when the app's mode markers
    // changed, or once in a long while.
    const nowT = performance.now();
    if (root.hasAttribute('data-pxt-flip') && !darkDirty && nowT - darkAt < 45000) return;
    darkDirty = false;
    darkAt = nowT;
    const d = computeDark();
    if (d !== siteDark) {
      siteDark = d;
      syncMode();
      syncPanel();
      if (!raf) paint(0);
    }
  }

  function startScan() {
    if (scanning) return;
    scanning = true;
    mo.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'data-state', 'hidden', 'open', 'aria-selected', 'aria-checked', 'aria-pressed', 'aria-current', 'data-selected', 'data-active', 'data-checked'] });
    fullScan();
    sampleTimer = setInterval(sample, 3000);
    setTimeout(sample, 600);
  }

  function stopScan() {
    if (!scanning) return;
    scanning = false;
    mo.disconnect();
    clearInterval(sampleTimer);
    clearTimeout(flushTimer);
    flushTimer = 0;
    deepQ.clear();
    shallowQ.clear();
  }

  /* --------------------------------------------------------------- renderer */

  const root = document.documentElement;
  const MODE_ATTRS = ['class', 'data-mode', 'data-theme', 'data-color-mode', 'data-color-scheme', 'data-appearance'];
  const modeWatch = new MutationObserver(() => { darkDirty = true; });
  modeWatch.observe(root, { attributes: true, attributeFilter: MODE_ATTRS });
  if (document.body) modeWatch.observe(document.body, { attributes: true, attributeFilter: MODE_ATTRS });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { darkDirty = true; });

  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const FPS = matchMedia('(pointer: coarse)').matches ? 10 : 12;
  let siteDark = false;
  let canvas = null;
  let world = null;
  let curId = 'off';
  let raf = 0;
  let last = 0;

  function measure() {
    const w = canvas.clientWidth || innerWidth;
    const h = canvas.clientHeight || innerHeight;
    const cell = Math.min(w, h) < 560 ? 11 : 14;
    // Keep the backing store under ~6M pixels on big screens.
    const dpr = clamp(Math.min(devicePixelRatio || 1, 2, Math.sqrt(6e6 / (w * h))), 1, 2);
    return { w, h, cell, dpr };
  }

  function ensureCanvas() {
    if (canvas && canvas.isConnected) return;
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.setAttribute('data-pxt-ui', 'bg');
      canvas.setAttribute('aria-hidden', 'true');
      world = new World(canvas);
      if (window.ResizeObserver) new ResizeObserver(onResize).observe(canvas);
      addEventListener('resize', onResize);
    }
    root.appendChild(canvas);
  }

  let resizeTimer = 0;
  function onResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resizeNow, 120);
  }

  function resizeNow() {
    if (!world || !world.th || curId === 'off') return;
    const m = measure();
    if (Math.abs(m.w - world.w) < 1 && Math.abs(m.h - world.h) < 1 && m.dpr === world.dpr) return;
    const { cols, rows, cell } = world;
    world.resize(m.w, m.h, m.cell, m.dpr);
    // Small changes (mobile toolbars) keep the scene; big ones rebuild it.
    if (m.cell !== cell || Math.abs(world.cols - cols) / cols > 0.25 || Math.abs(world.rows - rows) / rows > 0.25) world.setTheme(world.th);
    paint(0);
    if (open) place();
  }

  let mouse = { x: -999, y: -999, vx: 0, vy: 0, last: 0, active: false };
  window.addEventListener(
    'pointermove',
    (e) => {
      const now = performance.now();
      const dt = Math.max(0.016, (now - (mouse.last || now)) / 1000);
      const nx = e.clientX;
      const ny = e.clientY;
      if (mouse.last && dt > 0) {
        mouse.vx = clamp((nx - mouse.x) / dt / 30, -10, 10);
        mouse.vy = clamp((ny - mouse.y) / dt / 30, -10, 10);
      }
      mouse.x = nx;
      mouse.y = ny;
      mouse.last = now;
      mouse.active = true;
    },
    { passive: true },
  );

  /* ---------------------------------------------------- layout + mini bot */

  // Where the prompt box is: it anchors the reading column and the bot.
  const layout = { t: 0, box: null };
  function findPromptBox() {
    const cands = [...document.querySelectorAll('.epitaxy-prompt [class~="bg-surface-3"], fieldset')];
    if (!cands.length) {
      const ed = [...document.querySelectorAll('[contenteditable="true"], textarea')].pop();
      if (ed) cands.push(ed.parentElement && ed.parentElement.parentElement ? ed.parentElement.parentElement : ed);
    }
    let best = null;
    let held = null;
    for (const el of cands) {
      if (!el || el.closest('[data-pxt-ui]')) continue;
      if (el.tagName === 'FIELDSET' && !el.querySelector('[contenteditable="true"], textarea')) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 200 || r.height < 20 || r.bottom < 0 || r.top > innerHeight) continue;
      if (el.querySelector('[contenteditable="true"], textarea')) {
        if (!held || r.width * r.height < held.width * held.height) held = r;
      } else if (!best || r.width * (r.bottom / innerHeight) > best.width * (best.bottom / innerHeight)) best = r;
    }
    return held || best;
  }

  function updateLayout(now) {
    if (now - layout.t < 500) return;
    layout.t = now;
    layout.box = findPromptBox();
    const b = layout.box;
    world.col = b ? { x: b.left - 24, w: b.width + 48 } : { x: world.w / 2 - 400, w: 800 };
  }

  // Text follows the scene: a dark scene gets light text even when the app is in Light mode
  // (and the other way round), so words never sit dark-on-dark.
  const flipMode = () => {
    const th = world && world.th;
    if (!th || cfg.crisp === false || th.dark === siteDark) return '';
    return th.dark ? 'light-text' : 'dark-text';
  };
  const lookDark = () => {
    const f = flipMode();
    return f ? f === 'light-text' : siteDark;
  };

  /* Best fix for a dark scene on a Light app (or the reverse): switch the app's own light/dark
     mode for this page, so its menus, popups and text all match by themselves. The switch is
     found by trying the usual markers and keeping the first one that really changes the text
     color. If none works, the CSS text flip above stays as the fallback. Undone when the
     wallpaper is turned off. */
  let modeUndo = null;
  let modeForced = false;
  let modeFights = 0;

  // Which attribute or class does the app's CSS key its dark (or light) colors on?
  const markerMemo = {};
  function sheetMarkers(want) {
    if (markerMemo[want]) return markerMemo[want];
    const attrs = new Map();
    const classes = new Map();
    const reA = want === 'dark'
      ? /\[\s*(data-[\w-]+)\s*[~|^$*]?=\s*["']?([\w-]*dark[\w-]*)["']?\s*\]/g
      : /\[\s*(data-[\w-]+)\s*[~|^$*]?=\s*["']?([\w-]*light[\w-]*)["']?\s*\]/g;
    const reC = want === 'dark'
      ? /\.((?:[\w-]+[-_])?dark(?:[-_]\w+)*)(?![\w-])/g
      : /\.((?:[\w-]+[-_])?light(?:[-_]\w+)*)(?![\w-])/g;
    const t0 = performance.now();
    let n = 0;
    let media = 0;
    const bump = (m, k) => m.set(k, (m.get(k) || 0) + 1);
    const walk = (rules) => {
      for (const r of rules) {
        if (++n > 120000 || performance.now() - t0 > 300) return;
        const sel = r.selectorText;
        if (sel && sel.indexOf(want) >= 0 && sel.indexOf('pxt') < 0) {
          let m;
          reA.lastIndex = 0;
          while ((m = reA.exec(sel))) bump(attrs, m[1] + '=' + m[2]);
          reC.lastIndex = 0;
          while ((m = reC.exec(sel))) bump(classes, m[1]);
        }
        if (r.media && /prefers-color-scheme/.test(r.media.mediaText)) media++;
        if (r.cssRules && r.cssRules.length) walk(r.cssRules);
      }
    };
    for (const sh of [...document.styleSheets, ...(document.adoptedStyleSheets || [])]) {
      try {
        walk(sh.cssRules);
      } catch (e) {
        /* cross-origin sheet: cannot be read */
      }
    }
    const top = (m) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map((e) => e[0]);
    return (markerMemo[want] = { attrs: top(attrs), classes: top(classes), media, rules: n });
  }

  function nativeMode(wantDark) {
    const want = wantDark ? 'dark' : 'light';
    const other = wantDark ? 'light' : 'dark';
    const tries = [];
    // The page root first, then the few wrappers right under <body> (some apps put the mode there).
    const hosts = [root, document.body];
    if (document.body) {
      for (const k of document.body.children) {
        if (k.hasAttribute('data-pxt-ui') || SKIP.test(k.tagName)) continue;
        hosts.push(k);
        for (const g of k.children) if (hosts.length < 24 && !SKIP.test(g.tagName)) hosts.push(g);
      }
    }
    const word = new RegExp('(^|[-_:])' + other + '$');
    hosts.forEach((el, hi) => {
      if (!el) return;
      for (const at of [...el.attributes]) {
        const a = at.name;
        const v = at.value;
        if (a === 'class' || a === 'style' || a.startsWith('data-pxt') || v.length > 40) continue;
        let nv = null;
        if (v === other || word.test(v)) nv = v.replace(new RegExp(other + '$'), want);
        else if (hi < 2 && /mode|theme|scheme|appearance/.test(a) && (v === 'auto' || v === 'system')) nv = want;
        if (nv) tries.push({ apply: () => el.setAttribute(a, nv), undo: () => el.setAttribute(a, v) });
      }
      // Class names such as "light", "theme-light", "light-mode".
      const swaps = [];
      for (const c of el.classList) {
        if (c === other || word.test(c)) swaps.push([c, c.replace(new RegExp(other + '$'), want)]);
        else if (c.startsWith(other + '-')) swaps.push([c, want + c.slice(other.length)]);
      }
      if (swaps.length) {
        tries.push({
          apply: () => swaps.forEach(([o, n]) => el.classList.replace(o, n)),
          undo: () => swaps.forEach(([o, n]) => el.classList.replace(n, o)),
        });
      } else if (hi < 2 && wantDark && !el.classList.contains('dark')) {
        tries.push({ apply: () => el.classList.add('dark'), undo: () => el.classList.remove('dark') });
      } else if (hi < 2 && !wantDark && el.classList.contains('dark')) {
        tries.push({ apply: () => el.classList.remove('dark'), undo: () => el.classList.add('dark') });
      }
    });
    // Markers read from the app's own CSS (covers names we did not guess).
    let found = { attrs: [], classes: [] };
    try {
      found = sheetMarkers(want);
    } catch (e) {
      /* ignore */
    }
    for (const kv of found.attrs) {
      const i = kv.indexOf('=');
      const name = kv.slice(0, i);
      const val = kv.slice(i + 1);
      for (const el of [root, document.body]) {
        if (!el) continue;
        const prev = el.getAttribute(name);
        if (prev === val) continue;
        tries.push({ apply: () => el.setAttribute(name, val), undo: () => (prev == null ? el.removeAttribute(name) : el.setAttribute(name, prev)) });
      }
    }
    for (const cls of found.classes) {
      for (const el of [root, document.body]) {
        if (!el || el.classList.contains(cls)) continue;
        const twin = cls.replace(want, other);
        const hadTwin = el.classList.contains(twin);
        tries.push({
          apply: () => { el.classList.add(cls); if (hadTwin) el.classList.remove(twin); },
          undo: () => { el.classList.remove(cls); if (hadTwin) el.classList.add(twin); },
        });
      }
    }
    // Apps that follow the system setting through CSS color-scheme.
    const oldScheme = root.style.getPropertyValue('color-scheme');
    const oldPrio = root.style.getPropertyPriority('color-scheme');
    tries.push({
      apply: () => root.style.setProperty('color-scheme', want, 'important'),
      undo: () => (oldScheme ? root.style.setProperty('color-scheme', oldScheme, oldPrio) : root.style.removeProperty('color-scheme')),
    });
    for (const t of tries) {
      let ok = false;
      try {
        t.apply();
        ok = computeDark() === wantDark;
      } catch (e) {
        ok = false;
      }
      if (ok) return t.undo;
      try {
        t.undo();
      } catch (e) {
        /* ignore */
      }
    }
    return null;
  }

  function syncMode() {
    const th = world && world.th;
    const want = th && curId !== 'off' && cfg.crisp !== false ? th.dark : null;
    if (modeUndo && (want === null || want !== modeForced)) {
      try { modeUndo(); } catch (e) { /* ignore */ }
      modeUndo = null;
      siteDark = computeDark();
    }
    if (want === null || want === siteDark) return;
    if (modeFights > 1) return; // the app keeps switching back: leave it alone, the CSS flip takes over
    if (modeUndo) modeFights++;
    modeUndo = null;
    const undo = nativeMode(want);
    if (undo) {
      modeUndo = undo;
      modeForced = want;
      siteDark = want;
      setTimeout(verifyMode, 200);
    }
  }

  // If the app put its own mode straight back, stop trying and recolor the text instead.
  function verifyMode() {
    if (!modeUndo || curId === 'off') return;
    const d = computeDark();
    if (d === siteDark) return;
    modeUndo = null;
    modeFights = 9;
    siteDark = d;
    syncVars();
    unpaintMenus(true);
    menuSoon(false);
    syncPanel();
    if (!raf) paint(0);
  }

  let varsKey = null;
  function syncVars() {
    const flip = flipMode();
    const dark = lookDark();
    const key = flip + '|' + dark;
    if (varsKey === key) return;
    varsKey = key;
    if (flip) root.setAttribute('data-pxt-flip', flip);
    else root.removeAttribute('data-pxt-flip');
    root.style.setProperty('--pxt-halo', dark ? '0, 0, 0' : '255, 255, 255');
    root.style.setProperty('--pxt-card', dark ? '30, 29, 27' : '255, 255, 255');
    root.style.setProperty('--pxt-edge', dark ? '255, 255, 255' : '0, 0, 0');
  }

  // A tiny coral pixel bot that lives on top of the prompt box.
  const BOT_PAL = {
    H: ['#ee9670', '#b5583a'],
    B: ['#d97757', '#a24e2f'],
    A: ['#c4643f', '#8f3f22'],
    L: ['#b85a3a', '#7d361d'],
    e: ['#1b1411', null, ''],
  };
  const BOT_ROWS = {
    walkA: ['  HHHHHHH  ', '  BBBBBBB  ', 'AABBBBBBBAA', '  BBBBBBB  ', '  L L L L  '],
    walkB: ['  HHHHHHH  ', '  BBBBBBB  ', 'AABBBBBBBAA', '  BBBBBBB  ', '  LL   LL  '],
    hop: ['AAHHHHHHHAA', '  BBBBBBB  ', '  BBBBBBB  ', '  BBBBBBB  ', '   L L L   '],
  };
  const bot = { x: null, tx: 0, mode: 'idle', timer: 2, hopT: 0, blink: 3, look: 0, step: 0, poke: false };
  const botPoke = () => (bot.poke = true);
  document.addEventListener('input', (e) => {
    if (!e.target || !e.target.closest || !e.target.closest('[contenteditable], textarea')) return;
    if (layout.box) botPoke();
    menuSoon(false);
  }, true);
  document.addEventListener('keyup', (e) => { if (e.key === '/' || e.key === '@') menuSoon(false); }, true);
  document.addEventListener('click', () => menuSoon(true), true);

  /* Popups (the "/" list, the Mode picker, dropdowns) get ONE solid card, painted inline so
     no page rule can turn it see-through. The checks are event driven and only look at the
     prompt area, at popups mounted under <body> and at elements with a menu role, so a long
     transcript costs nothing. */
  const MENU_WORDS = new Set(['btw', 'ultrareview', 'rewind', 'fork', 'subtask', 'mcp', 'plugin', 'feedback', 'model', 'effort', 'fast', 'plan', 'permissions', 'compact', 'clear', 'config', 'context', 'cost', 'help', 'init', 'memory', 'resume', 'review', 'status', 'usage']);
  const EDITOR_SEL = '[contenteditable="true"], [contenteditable="plaintext-only"], textarea';
  const ROLE_SEL = '[role="listbox"], [role="menu"], [role="dialog"], [role="tooltip"], [data-radix-popper-content-wrapper]';
  const MENU_PROPS = ['background-color', 'background-image', 'box-shadow', 'border-radius', 'text-shadow', 'color', '-webkit-text-fill-color'];
  const panelSized = (r) => r.height < innerHeight * 0.85 && (r.width * r.height) / (innerWidth * innerHeight) < 0.5;
  const ownText = (el) => {
    for (let n = el.firstChild; n; n = n.nextSibling) if (n.nodeType === 3 && n.nodeValue.trim().length > 1) return true;
    return false;
  };
  const decorated = (el) => {
    const cs = getComputedStyle(el);
    return parseFloat(cs.borderTopLeftRadius) >= 6 || cs.boxShadow !== 'none' || parseFloat(cs.borderTopWidth) > 0;
  };
  const menus = new Set();
  let menuT1 = 0;
  let menuT2 = 0;
  let netT = 0;
  let menuLaterTimer = 0;

  function menuSoon(withNet) {
    clearTimeout(menuT1);
    clearTimeout(menuT2);
    menuT1 = setTimeout(scanMenus, 70);
    menuT2 = setTimeout(scanMenus, 320);
    if (withNet) {
      clearTimeout(netT);
      netT = setTimeout(() => {
        if (scanning) sample();
        scanOverlaps();
      }, 380);
    }
  }
  // Page changes re-check too, but rarely and only with the cheap checks.
  function menuLater() {
    if (menuLaterTimer) return;
    menuLaterTimer = setTimeout(() => {
      menuLaterTimer = 0;
      if (!document.hidden) scanMenus();
    }, 700);
  }

  // The prompt box with the short strip of page around it (where the "/" list is mounted).
  function promptRegion() {
    let ed = null;
    for (const e of document.querySelectorAll(EDITOR_SEL)) if (!e.closest('[data-pxt-ui]') && e.getClientRects().length) ed = e;
    if (!ed) return null;
    let reg = ed;
    for (let p = ed.parentElement, i = 0; p && p !== document.body && i < 10; i++, p = p.parentElement) {
      if (p.getBoundingClientRect().height > innerHeight * 0.7) break;
      reg = p;
    }
    return reg;
  }

  // From a list of items up to the box that draws the popup.
  function menuRoot(list) {
    const lr = list.getBoundingClientRect();
    let best = list;
    if (decorated(list)) return list;
    for (let el = list.parentElement, i = 0; el && el !== document.body && i < 6; i++, el = el.parentElement) {
      if (el.querySelector(EDITOR_SEL)) break;
      const r = el.getBoundingClientRect();
      if (!panelSized(r) || r.width > lr.width * 3 + 40) break;
      best = el;
      if (decorated(el)) break;
      const p = getComputedStyle(el).position;
      if (p === 'absolute' || p === 'fixed') break;
    }
    return best;
  }

  // A bare positioning wrapper is skipped in favor of the box that draws the panel.
  function drawnPanel(el) {
    for (let i = 0; i < 4; i++) {
      if (decorated(el) || el.hasAttribute('data-pxt') || el.children.length !== 1 || ownText(el)) break;
      const a = el.getBoundingClientRect();
      const b = el.children[0].getBoundingClientRect();
      if (b.width * b.height < a.width * a.height * 0.6) break;
      el = el.children[0];
    }
    return el;
  }

  function paintMenu(el) {
    if (!el || !el.isConnected || el === document.body || el === root) return;
    // Already inside a card of ours: use that one instead of stacking a second layer.
    for (let p = el.closest('[data-pxt="pop"]'); p && !p.querySelector(EDITOR_SEL); p = p.parentElement && p.parentElement.closest('[data-pxt="pop"]')) el = p;
    if (menus.has(el) || el.closest('[data-pxt-ui], [data-pxt-menu], ' + BUBBLE_SEL) || el.querySelector('[data-pxt-menu]')) return;
    if (el.matches(EDITOR_SEL) || el.querySelector(EDITOR_SEL)) return;
    menus.add(el);
    el.setAttribute('data-pxt-menu', '');
    const s = el.style;
    s.setProperty('background-color', 'rgb(var(--pxt-card))', 'important');
    s.setProperty('background-image', 'none', 'important');
    s.setProperty('box-shadow', '0 0 0 1px rgba(var(--pxt-edge), .14), 0 10px 28px rgba(0, 0, 0, .35)', 'important');
    if (parseFloat(getComputedStyle(el).borderTopLeftRadius) < 6) s.setProperty('border-radius', '12px', 'important');
    s.setProperty('text-shadow', 'none', 'important');
  }

  function unpaintMenus(all) {
    for (const el of menus) {
      if (!all && el.isConnected) continue;
      menus.delete(el);
      el.removeAttribute('data-pxt-menu');
      for (const p of MENU_PROPS) el.style.removeProperty(p);
    }
  }

  function scanMenus() {
    unpaintMenus(false);
    if (curId === 'off' || !document.body) return;
    const lists = new Set();
    // 1. The "/" list: three or more command names close together near the prompt box.
    const reg = promptRegion();
    const roots = reg ? [reg] : [];
    for (const el of document.body.children) {
      if (el.hasAttribute('data-pxt-ui') || SKIP.test(el.tagName) || (reg && el.contains(reg))) continue;
      const cs = getComputedStyle(el);
      if (cs.display === 'none') continue;
      const r = el.getBoundingClientRect();
      if (r.width < 40 || r.height < 24 || !el.textContent.trim()) continue;
      roots.push(el);
      // 2. Popups mounted straight under <body> (dropdowns, mode pickers, tooltips).
      if ((cs.position === 'fixed' || cs.position === 'absolute') && panelSized(r) && !el.querySelector(EDITOR_SEL)) lists.add(drawnPanel(el));
    }
    for (const rt of roots) {
      const items = [];
      const w = document.createTreeWalker(rt, NodeFilter.SHOW_TEXT);
      let seen = 0;
      for (let t = w.nextNode(); t && seen < 4000; t = w.nextNode(), seen++) {
        const v = t.nodeValue;
        if (v.length > 14 || !MENU_WORDS.has(v.trim().replace(/^\//, ''))) continue;
        const p = t.parentElement;
        if (p && !p.closest('[data-pxt-ui], pre, code, [contenteditable]')) items.push(p);
      }
      if (items.length < 3) continue;
      let el = items[0].parentElement;
      for (let i = 0; el && el !== document.body && i < 10; i++, el = el.parentElement) {
        let n = 0;
        for (const o of items) if (el.contains(o)) n++;
        if (n >= 3) { lists.add(menuRoot(el)); break; }
      }
    }
    // 3. Anything that says it is a menu.
    for (const el of document.querySelectorAll(ROLE_SEL)) {
      if (el.closest('[data-pxt-ui]') || !el.getClientRects().length) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 40 || r.height < 24 || !panelSized(r)) continue;
      lists.add(el.hasAttribute('role') ? menuRoot(el) : drawnPanel(el));
    }
    for (const l of lists) paintMenu(l);
  }

  // The widest box around `top` that is still "the popup": it holds the point, stays
  // panel sized, and stops before the prompt box or anything shared with what is behind.
  function panelAround(top, x, y, behind) {
    let a = top;
    for (let p = top.parentElement; p && p !== document.body && p !== root; p = p.parentElement) {
      if (p.contains(behind) || p.querySelector(EDITOR_SEL)) break;
      const r = p.getBoundingClientRect();
      if (!panelSized(r) || x < r.left || x > r.right || y < r.top || y > r.bottom) break;
      a = p;
      if (decorated(p)) break;
    }
    return a;
  }

  // Safety net after a click, needing no knowledge of the page: wherever words sit on top of
  // other words with nothing solid in between, the front panel gets a card. It runs in small
  // slices so it never blocks typing or scrolling, and it leaves the prompt strip alone.
  let netRun = 0;
  function scanOverlaps() {
    if (curId === 'off' || document.hidden) return;
    const run = ++netRun;
    const vw = innerWidth;
    const vh = innerHeight;
    const rows = clamp(Math.round(vh / 22), 20, 48);
    const floor = layout.box ? layout.box.top - 2 : vh;
    const memo = new Map();
    const alpha = (e) => {
      let v = memo.get(e);
      if (v === undefined) {
        const c = toRGBA(getComputedStyle(e).backgroundColor);
        v = c ? c.a : 0;
        memo.set(e, v);
      }
      return v;
    };
    let gy = 0;
    (function slice() {
      if (run !== netRun) return;
      const t0 = performance.now();
      for (; gy < rows && performance.now() - t0 < 6; gy++) {
        const y = ((gy + 0.37) * vh) / rows;
        if (y >= floor) continue;
        for (let gx = 0; gx < 16; gx++) {
          const x = ((gx + 0.5) * vw) / 16;
          const st = document.elementsFromPoint(x, y);
          const top = st[0];
          if (!top || top === root || top === document.body || SKIP.test(top.tagName)) continue;
          if (top.closest('[data-pxt-ui], [data-pxt-menu], ' + BUBBLE_SEL + ', ' + EDITOR_SEL)) continue;
          if (!ownText(top) && !(top.children.length <= 3 && top.textContent.length < 200 && top.textContent.trim().length > 1)) continue;
          if (alpha(top) >= 0.8) continue;
          // Neighbors that only share an edge are not on top of each other.
          const inside = (e) => {
            const r = e.getBoundingClientRect();
            return x > r.left + 1 && x < r.right - 1 && y > r.top + 1 && y < r.bottom - 1;
          };
          if (!inside(top)) continue;
          let behind = null;
          for (let i = 1; i < st.length && i < 28; i++) {
            const e = st[i];
            if (e === document.body || e === root) break;
            if (SKIP.test(e.tagName)) continue;
            if (alpha(e) >= 0.8) break;
            if (e.contains(top) || top.contains(e)) continue;
            if (ownText(e) && inside(e) && !e.closest('[data-pxt-ui]')) { behind = e; break; }
          }
          if (!behind) continue;
          const a = drawnPanel(panelAround(top, x, y, behind));
          const r = a.getBoundingClientRect();
          if (r.top >= floor || r.height < 40) continue;
          paintMenu(a);
        }
      }
      if (gy < rows) setTimeout(slice, 24);
    })();
  }

  function botFrame(w, dt) {
    const b = layout.box;
    if (!cfg.bot || !b || curId === 'off') return;
    const bs = clamp(Math.round(w.cell * 0.82), 9, 12);
    const W = 11 * bs;
    const H = 5 * bs;
    const minX = b.left + 12;
    const maxX = Math.max(minX, b.right - W - 12);
    if (bot.x == null || bot.x < minX - 40 || bot.x > maxX + 40) bot.x = maxX;
    const mx = mouse.x;
    const my = mouse.y;
    const near = mouse.active && Math.abs(mx - (bot.x + W / 2)) < W && Math.abs(my - (b.top - H / 2)) < H * 1.5;
    bot.timer -= dt;
    if ((bot.poke || near) && bot.mode !== 'hop') {
      bot.mode = 'hop';
      bot.hopT = 0;
    }
    bot.poke = false;
    if (bot.mode === 'idle' && bot.timer <= 0) {
      const r = Math.random();
      if (r < 0.6) {
        bot.mode = 'walk';
        bot.tx = rnd(minX, maxX);
      } else if (r < 0.8) {
        bot.mode = 'hop';
        bot.hopT = 0;
      }
      bot.timer = rnd(2, 5);
    }
    let lift = 0;
    let rows = BOT_ROWS.walkA;
    if (bot.mode === 'walk') {
      bot.tx = clamp(bot.tx, minX, maxX);
      const d = bot.tx - bot.x;
      const v = 55 * dt;
      bot.look = d > 0 ? 1 : -1;
      if (Math.abs(d) <= v) {
        bot.x = bot.tx;
        bot.mode = 'idle';
      } else bot.x += Math.sign(d) * v;
      bot.step += dt;
      rows = Math.floor(bot.step / 0.16) % 2 ? BOT_ROWS.walkB : BOT_ROWS.walkA;
    } else if (bot.mode === 'hop') {
      bot.hopT += dt;
      const T = 0.5;
      lift = Math.sin(Math.PI * Math.min(1, bot.hopT / T)) * bs * 2;
      rows = bot.hopT < T * 0.8 ? BOT_ROWS.hop : BOT_ROWS.walkA;
      if (bot.hopT >= T) bot.mode = 'idle';
    } else {
      lift = (Math.sin(w.t * 3) + 1) * 0.6;
      if (mouse.active) bot.look = mx > bot.x + W / 2 ? 1 : -1;
    }
    bot.x = clamp(bot.x, minX, maxX);
    bot.blink -= dt;
    const blinking = bot.blink < 0.14;
    if (bot.blink < 0) bot.blink = rnd(2.2, 5);
    const x0 = Math.round(bot.x);
    const y0 = Math.round(b.top - H - 3 - lift);
    const ctx = w.ctx;
    // Soft shadow on the prompt edge.
    ctx.globalAlpha = 0.28 * (1 - lift / (bs * 3));
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(x0 + W / 2, b.top - 1, W * 0.38, bs * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    const flick = Math.floor(w.t * 2);
    for (let j = 0; j < rows.length; j++) {
      for (let i = 0; i < 11; i++) {
        const p = BOT_PAL[rows[j][i]];
        if (!p) continue;
        w.tileAt(x0 + i * bs, y0 + j * bs, bs, p[0], p[1], 'tS%$'[(i * 3 + j + flick) % 4]);
      }
    }
    // Eyes on the second row, glancing the way the bot faces.
    const ey = y0 + bs;
    for (const c of [3, 7]) {
      const ex = x0 + (c + bot.look) * bs;
      if (blinking) {
        ctx.fillStyle = BOT_PAL.e[0];
        ctx.fillRect(ex + bs * 0.15, ey + bs * 0.45, bs * 0.7, bs * 0.18);
      } else w.tileAt(ex, ey, bs, BOT_PAL.e[0], null, '');
    }
  }

  function paint(dt) {
    if (!world || !world.th) return;
    const now = performance.now();
    const th = world.th;
    const mismatch = th.dark !== lookDark();
    syncVars();
    updateLayout(now);
    // No more full-screen fog: only a soft band behind the chat column.
    world.veil = 0;
    world.fx = !safe.fx;
    world.bloom = th.dark ? 0.32 : 0.14;
    world.scrimRGB = lookDark() ? '12, 11, 10' : '255, 253, 249';
    world.scrimA = clamp(0.1 + cfg.veil * (th.veilScale || 1) * 0.9 + (mismatch ? 0.22 : 0), 0, 0.85);
    world.afterFx = safe.bot ? null : botFrame;
    world.mouse = {
      x: mouse.x / world.cell,
      y: mouse.y / world.cell,
      vx: mouse.vx || 0,
      vy: mouse.vy || 0,
      active: mouse.active && now - mouse.last < 800,
    };
    mouse.vx *= 0.85;
    mouse.vy *= 0.85;
    world.draw(dt);
  }

  // The system "reduce motion" setting (Windows: Animation effects off) is respected unless
  // the user ticks the override in the picker.
  const running = () => curId !== 'off' && cfg.motion && (!reduce.matches || !cfg.calm) && !document.hidden;

  // One frame. A scene or the bot throwing must never freeze the wallpaper: the error is
  // logged once and the optional layers are dropped one by one until frames draw again.
  let lastPaintAt = 0;
  let paintErrs = 0;
  let lastErr = '';
  let tick = 0;
  const safe = { bot: false, fx: false };
  function frame(now) {
    if (last && now - last < 1000 / FPS - 2) return;
    const dt = last ? Math.min(0.2, Math.max(0, (now - last) / 1000)) : 1 / FPS;
    last = now;
    try {
      paint(dt);
      lastPaintAt = performance.now();
      paintErrs = 0;
    } catch (e) {
      lastErr = String((e && e.stack) || e).slice(0, 500);
      if (++paintErrs === 1) console.warn('[Pixel Themes] loi khi ve khung hinh:', e);
      if (paintErrs === 3) safe.bot = true;
      if (paintErrs === 6) safe.fx = true;
    }
  }

  function loop(now) {
    raf = 0;
    if (!running()) return;
    raf = requestAnimationFrame(loop);
    frame(now);
  }

  // If the browser stops calling us back while the page is still showing (it happens in some
  // embedded windows), a plain timer takes over so the scene keeps moving.
  setInterval(() => {
    if (!running()) return;
    if (!raf) raf = requestAnimationFrame(loop);
    if (!tick && performance.now() - lastPaintAt > 1400) {
      tick = setInterval(() => { if (running()) frame(performance.now()); }, Math.round(1000 / FPS));
    }
  }, 1500);

  function startLoop() {
    if (!raf && running()) {
      last = 0;
      raf = requestAnimationFrame(loop);
    }
  }

  function stopLoop() {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }

  document.addEventListener('visibilitychange', () => (document.hidden ? stopLoop() : startLoop()));

  function applyTheme(id) {
    const th = byId(id);
    if (!th) {
      root.removeAttribute('data-pxt-on');
      unpaintMenus(true);
      stopLoop();
      stopScan();
      curId = 'off';
      syncMode();
      syncPanel();
      return;
    }
    ensureCanvas();
    root.setAttribute('data-pxt-on', '');
    root.toggleAttribute('data-pxt-crisp', cfg.crisp !== false);
    root.style.setProperty('--pxt-alpha', String(cfg.glass));
    root.style.setProperty('--pxt-blur', '0px');
    siteDark = computeDark();
    const m = measure();
    if (m.w !== world.w || m.h !== world.h || m.dpr !== world.dpr || m.cell !== world.cell) world.resize(m.w, m.h, m.cell, m.dpr);
    if (curId !== id) {
      world.setTheme(th);
      curId = id;
    }
    try {
      syncMode();
    } catch (e) {
      console.warn('[Pixel Themes] khong doi duoc che do sang/toi:', e);
    }
    syncVars();
    unpaintMenus(true);
    menuSoon(true);
    syncPanel();
    startScan();
    paint(0);
    startLoop();
  }

  /* --------------------------------------------------------------------- UI */

  function h(tag, props, ...kids) {
    const el = document.createElement(tag);
    for (const k in props || {}) {
      const v = props[k];
      if (k === 'class') el.className = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (v === true) el.setAttribute(k, '');
      else if (v != null && v !== false) el.setAttribute(k, v);
    }
    for (const kid of kids.flat()) if (kid != null) el.append(kid);
    return el;
  }

  const FAB_COLORS = ['#86c3f2', '#ffffff', '#d97757', '#34b6c4', '#ff8fc8', '#d9ff6e', '#b49cff', '#fff2c7', '#ff7b2e'];

  let host = null;
  let fab = null;
  let panel = null;
  let note = null;
  let list = null;
  let items = [];
  let open = false;
  let fromCmd = false;
  let editor = null;
  let anchor = null;
  let sel = 0;

  function thumb(th) {
    const cv = document.createElement('canvas');
    const w = new World(cv);
    w.resize(92, 60, 4, 2);
    w.setTheme(th);
    w.draw(0.5);
    w.draw(0.5);
    return cv;
  }

  function buildUI() {
    host = h('div', { 'data-pxt-ui': 'host' });
    const sh = host.attachShadow({ mode: 'open' });
    sheet(UI_CSS, sh);

    fab = h(
      'button',
      { class: 'fab', type: 'button', title: 'Pixel themes  (/theme · Alt+T)', 'aria-label': 'Đổi hình nền pixel', onclick: () => (open ? closePicker(false) : openPicker(null, false)) },
      FAB_COLORS.map((c) => {
        const i = h('i');
        i.style.setProperty('background', c);
        return i;
      }),
    );
    fab.hidden = !cfg.button;

    panel = h('div', { class: 'panel', role: 'dialog', 'aria-label': 'Chọn hình nền pixel', hidden: true });
    sh.append(fab, panel);
    root.appendChild(host);
  }

  function buildPanel() {
    list = h('div', { class: 'list', role: 'listbox', 'aria-label': 'Themes' });
    items = ITEMS.map((id, i) => {
      const th = byId(id);
      const btn = h(
        'button',
        {
          class: 'it',
          type: 'button',
          role: 'option',
          onclick: () => {
            sel = i;
            commit(id);
            if (fromCmd) {
              fromCmd = false;
              clearEditor(editor);
            }
          },
        },
        h('span', { class: 'th' }, th ? thumb(th) : h('span', { class: 'off' }, 'OFF')),
        h('span', { class: 'nm' }, th ? th.name : 'Tắt'),
      );
      list.append(btn);
      return btn;
    });

    const range = (label, min, max, key, after) =>
      h(
        'label',
        null,
        label,
        h('input', {
          type: 'range',
          min,
          max,
          step: '0.05',
          value: String(cfg[key]),
          oninput: (e) => {
            cfg[key] = +e.target.value;
            save();
            after();
          },
        }),
      );
    const check = (label, key, after) =>
      h(
        'label',
        null,
        h('input', {
          type: 'checkbox',
          checked: cfg[key],
          onchange: (e) => {
            cfg[key] = e.target.checked;
            save();
            after();
          },
        }),
        label,
      );

    note = h('div', { class: 'note', hidden: true });
    panel.append(
      h('div', { class: 'hd' }, h('span', { class: 'cmd' }, '/theme'), h('span', { class: 'ttl' }, 'Pixel wallpapers'), h('span', { class: 'hint' }, '← → chọn · ↵ áp dụng · esc đóng')),
      note,
      list,
      h(
        'div',
        { class: 'ctl' },
        range('Làm dịu cột chat', '0', '0.8', 'veil', () => {
          if (!raf) paint(0);
        }),
        range('Độ đục khung', '0.3', '0.95', 'glass', () => {
          root.style.setProperty('--pxt-alpha', String(cfg.glass));
        }),
        check('Chữ rõ nét', 'crisp', () => {
          root.toggleAttribute('data-pxt-crisp', cfg.crisp);
          paint(0);
        }),
        check('Bot Claude', 'bot', () => {
          if (!raf) paint(0);
        }),
        range('Mật độ', '0.5', '2.0', 'density', () => {
          if (world && world.th && world.th.init) world.th.init(world);
          if (!raf) paint(0);
        }),
        range('Tốc độ', '0.5', '2.0', 'speed', () => {}),
        check('Chuyển động', 'motion', () => {
          if (cfg.motion) startLoop();
          else stopLoop();
        }),
        check('Đứng yên khi Windows tắt hiệu ứng động', 'calm', () => {
          if (running()) startLoop();
          else stopLoop();
        }),
        check('Tự đổi ngày/đêm', 'autoCycle', () => {
          checkAutoCycle(true);
        }),
        check('Nút nổi', 'button', () => {
          fab.hidden = !cfg.button;
        }),
      ),
    );
  }

  function syncPanel() {
    if (!panel) return;
    panel.classList.toggle('dark', siteDark);
    if (!note) return;
    const th = byId(curId);
    note.hidden = !th || th.dark === siteDark;
    note.textContent =
      cfg.crisp !== false
        ? th && th.dark
          ? 'Chữ đã tự đổi sang màu sáng cho dễ đọc. Bật giao diện Dark của app để đẹp nhất.'
          : 'Chữ đã tự đổi sang màu tối cho dễ đọc. Bật giao diện Light của app để đẹp nhất.'
        : th && th.dark
          ? 'Theme tối: bật giao diện Dark của trang để màu rõ hơn.'
          : 'Theme sáng: hợp với giao diện Light của trang hơn.';
  }

  function highlight() {
    syncPanel();
    items.forEach((b, i) => {
      b.classList.toggle('sel', i === sel);
      b.classList.toggle('cur', ITEMS[i] === cfg.theme);
      b.setAttribute('aria-selected', String(i === sel));
    });
    // The grid wraps; on a short screen it scrolls vertically to keep the selection in view.
    const b = items[sel];
    if (b && list) {
      const T = b.offsetTop;
      const B = T + b.offsetHeight;
      if (T < list.scrollTop) list.scrollTop = T - 4;
      else if (B > list.scrollTop + list.clientHeight) list.scrollTop = B - list.clientHeight + 4;
    }
  }

  function place() {
    const a = anchor && anchor.isConnected ? (anchor.closest('fieldset, form') || anchor).getBoundingClientRect() : null;
    const ph = panel.offsetHeight;
    const pw = panel.offsetWidth;
    const vh = innerHeight;
    const vw = document.documentElement.clientWidth || innerWidth;
    let top = vh - ph - 96;
    if (a && a.top - ph - 10 > 8) top = a.top - ph - 10;
    else if (a && a.bottom + ph + 10 < vh) top = a.bottom + 10;
    panel.style.setProperty('top', Math.max(8, top) + 'px');
    panel.style.setProperty('left', clamp(a ? a.left + a.width / 2 : vw / 2, pw / 2 + 10, vw - pw / 2 - 10) + 'px');
  }

  function openPicker(anchorEl, cmd) {
    if (!items.length) buildPanel();
    open = true;
    fromCmd = !!cmd;
    anchor = anchorEl;
    sel = Math.max(0, ITEMS.indexOf(cfg.theme));
    panel.hidden = false;
    highlight();
    place();
  }

  function closePicker(keep) {
    if (!open) return;
    if (!keep && curId !== cfg.theme) applyTheme(cfg.theme);
    open = false;
    fromCmd = false;
    anchor = null;
    panel.hidden = true;
  }

  function move(d) {
    sel = (sel + d + ITEMS.length) % ITEMS.length;
    applyTheme(ITEMS[sel]); // live preview, saved only on Enter / click
    highlight();
  }

  function commit(id) {
    cfg.theme = id;
    save();
    applyTheme(id);
    if (open) highlight();
  }

  function findTheme(q) {
    q = strip(q);
    if (!q) return -1;
    if (/^(off|tat|none|0)$/.test(q)) return ITEMS.indexOf('off');
    const exact = THEMES.findIndex((t) => t.id === q || strip(t.name) === q || t.alias.includes(q));
    if (exact >= 0) return exact;
    return THEMES.findIndex((t) => t.id.startsWith(q) || strip(t.name).includes(q) || t.alias.some((a) => a.startsWith(q)));
  }

  /* ------------------------------------------------------- /theme command */

  // "/thêm" and "/nen" are there because Vietnamese Telex keyboards turn "theme" into "thêm".
  const CMD = /^\/(theme|thêm|them|nen|nền)(?:\s+(.*))?$/iu;

  function editableRoot(t) {
    if (!t || t.nodeType !== 1) return null;
    if (t.tagName === 'TEXTAREA' || (t.tagName === 'INPUT' && /^(text|search)$/i.test(t.type))) return t;
    return t.closest('[contenteditable="true"], [contenteditable=""], [contenteditable="plaintext-only"]');
  }

  const textOf = (el) => (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT' ? el.value : el.innerText || '');

  function clearEditor(el) {
    if (!el || !el.isConnected) return;
    if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
      const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, '');
      el.dispatchEvent(new Event('input', { bubbles: true }));
      return;
    }
    el.focus();
    const range = document.createRange();
    range.selectNodeContents(el);
    const s = getSelection();
    s.removeAllRanges();
    s.addRange(range);
    if (!document.execCommand('delete', false)) el.textContent = '';
  }

  function runCommand(text) {
    const m = CMD.exec(String(text).normalize('NFC').trim());
    if (!m) return false;
    const i = m[2] ? findTheme(m[2]) : -1;
    if (i >= 0) commit(ITEMS[i]);
    else openPicker(null, false);
    return true;
  }

  document.addEventListener(
    'input',
    (e) => {
      const el = editableRoot(e.target);
      if (!el || (host && host.contains(el))) return;
      const m = CMD.exec(textOf(el).normalize('NFC').trim());
      if (m) {
        editor = el;
        if (!open) openPicker(el, true);
        fromCmd = true;
        const i = m[2] ? findTheme(m[2]) : -1;
        if (i >= 0 && i !== sel) {
          sel = i;
          applyTheme(ITEMS[i]);
          highlight();
        }
      } else if (open && fromCmd) {
        closePicker(false);
      }
    },
    true,
  );

  addEventListener(
    'keydown',
    (e) => {
      if (e.altKey && e.shiftKey && (e.code === 'ArrowRight' || e.key === 'ArrowRight')) {
        e.preventDefault();
        const curIdx = Math.max(0, ITEMS.indexOf(cfg.theme));
        const nextIdx = (curIdx + 1) % ITEMS.length;
        commit(ITEMS[nextIdx]);
        return;
      }
      if (e.altKey && e.shiftKey && (e.code === 'ArrowLeft' || e.key === 'ArrowLeft')) {
        e.preventDefault();
        const curIdx = Math.max(0, ITEMS.indexOf(cfg.theme));
        const prevIdx = (curIdx - 1 + ITEMS.length) % ITEMS.length;
        commit(ITEMS[prevIdx]);
        return;
      }
      if (e.altKey && !e.ctrlKey && !e.metaKey && e.code === 'KeyT') {
        e.preventDefault();
        if (open) closePicker(false);
        else openPicker(editableRoot(document.activeElement), false);
        return;
      }
      if (!open || e.isComposing) return;
      const target = e.composedPath()[0];
      if (target && target.tagName === 'INPUT' && target.type === 'range') return;
      // Opened from the button while the user types elsewhere: only Esc belongs to us.
      if (!fromCmd && editableRoot(document.activeElement) && e.key !== 'Escape') return;
      const stop = () => {
        e.preventDefault();
        e.stopImmediatePropagation();
      };
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        stop();
        move(e.key === 'ArrowRight' ? 1 : -1);
      } else if (e.key === 'Enter' && !e.shiftKey) {
        stop();
        const wasCmd = fromCmd;
        commit(ITEMS[sel]);
        closePicker(true);
        if (wasCmd) clearEditor(editor);
      } else if (e.key === 'Escape') {
        stop();
        closePicker(false);
      }
    },
    true,
  );

  document.addEventListener(
    'pointerdown',
    (e) => {
      if (open && !e.composedPath().includes(host) && !(fromCmd && e.composedPath().includes(editor))) closePicker(false);
    },
    true,
  );

  addEventListener('resize', () => open && place());
  if (window.visualViewport) visualViewport.addEventListener('resize', () => open && place());
  reduce.addEventListener && reduce.addEventListener('change', () => (running() ? startLoop() : (stopLoop(), paint(0))));

  /* ------------------------------------------------------------------- boot */

  window.__pixelThemes = {
    version: VERSION,
    themes: ITEMS.slice(),
    get current() {
      return cfg.theme;
    },
    set(id) {
      if (!ITEMS.includes(id)) return false;
      commit(id);
      return true;
    },
    open: () => openPicker(null, false),
    close: () => closePicker(true),
    command: runCommand,
    // For troubleshooting: copy(JSON.stringify(__pixelThemes.debug()))
    debug: () => ({
      version: VERSION, theme: curId, running: running(), motion: cfg.motion, reducedMotion: reduce.matches, calm: cfg.calm, hidden: document.hidden,
      raf: !!raf, timer: !!tick, msSincePaint: Math.round(performance.now() - lastPaintAt), paintErrs, lastErr, safe: { ...safe },
      siteDark, flip: flipMode(), appModeSwitched: !!modeUndo, modeFights,
      rootAttrs: [...root.attributes].filter((a) => !a.name.startsWith('data-pxt') && a.name !== 'style').map((a) => a.name + '=' + a.value.slice(0, 80)),
      bodyAttrs: document.body ? [...document.body.attributes].filter((a) => a.name !== 'style').map((a) => a.name + '=' + a.value.slice(0, 80)) : [],
      darkMarkers: (() => { try { return sheetMarkers('dark'); } catch (e) { return String(e); } })(),
      systemDark: matchMedia('(prefers-color-scheme: dark)').matches,
      box: layout.box ? [layout.box.left, layout.box.top, layout.box.width, layout.box.height].map(Math.round) : null,
      bot: { x: bot.x == null ? null : Math.round(bot.x), mode: bot.mode },
    }),
  };

  function checkAutoCycle(force) {
    if (!cfg.autoCycle) return;
    const hr = new Date().getHours();
    const isDay = hr >= 6 && hr < 18;
    const target = isDay ? 'sakura' : 'moon';
    if (cfg.theme !== target || force) {
      commit(target);
    }
  }

  function boot() {
    if (!document.body) {
      setTimeout(boot, 50);
      return;
    }
    sheet(PAGE_CSS, document);
    buildUI();
    if (cfg.autoCycle) checkAutoCycle();
    applyTheme(cfg.theme);
    setInterval(checkAutoCycle, 60000);
    say('✅ Pixel Themes đã chạy. Bấm Alt+T (hoặc nút ô vuông màu ở cạnh phải) để chọn theme.');
    if (reduce.matches && cfg.calm) {
      say('ℹ️ Windows đang tắt "Animation effects" nên hình nền và bot đứng yên. Bấm Alt+T rồi bỏ tick "Đứng yên khi Windows tắt hiệu ứng động" để bật lại.');
    }
  }

  boot();
})();
