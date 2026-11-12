  /* ------------------------------------------------- custom: Code Bốc Lửa */
  // File riêng, launcher ghép vào ngay trước "const ITEMS = THEMES.map(...)" của
  // pixel-themes-claude-desktop.js, nên dùng chung được rnd/rint/clamp/hash/vgrad/rglow/THEMES.
  // Code bốc lên từ một lớp than hồng ở đáy: trắng -> vàng -> cam -> đỏ -> tàn tro rồi tắt.

  const BOC_TOKENS = [
    'const', 'let', 'var', '=>', '{}', '()', '[]', 'fn', 'if', 'else', 'return', 'async', 'await',
    'yield', 'null', 'true', 'false', 'void', 'NaN', '0x1F', '0xFF', '01', '10', '1', '0', '</>',
    '&&', '||', '!=', '===', '++', '::', '#', '$', '%', '*', ';', 'λ', 'try{}', 'catch', 'throw',
    'import', 'export', 'class', 'struct', 'def', 'pub fn', 'impl', 'match', 'while', 'for',
    'git push', 'npm i', 'claude', '// TODO', 'sudo', 'main()', 'printf', 'malloc', 'eboot',
  ];
  // [mốc tuổi, màu chữ] — tuổi 0 là vừa bốc lên, 1 là tắt hẳn.
  const BOC_HEAT = [
    [0.1, '#fff7d6'],
    [0.24, '#ffd27a'],
    [0.42, '#ff9a3d'],
    [0.62, '#e8642c'],
    [0.82, '#b23a1c'],
    [1.01, '#5e2214'],
  ];
  const bocColor = (f) => {
    for (const [k, c] of BOC_HEAT) if (f < k) return c;
    return BOC_HEAT[BOC_HEAT.length - 1][1];
  };

  function bocSpawn(w, p, first) {
    const tok = BOC_TOKENS[(Math.random() * BOC_TOKENS.length) | 0];
    p.tok = tok;
    p.x = rnd(0, Math.max(1, w.cols - tok.length));
    p.y0 = first ? rnd(w.rows * 0.35, w.rows) : w.rows - rnd(0, 2.5);
    p.y = p.y0;
    p.vy = rnd(2.5, 7);
    // Đa số tắt sớm gần đáy (lửa dày ở dưới), số ít bốc cao tới gần đỉnh.
    p.maxH = w.rows * (0.18 + Math.pow(Math.random(), 1.6) * 0.8);
    p.age = first ? rnd(0, 0.6) : 0;
    p.ph = rnd(0, 6.28);
    p.wf = rnd(0.6, 1.8);
    p.wa = rnd(0.2, 0.9);
    p.fl = rnd(5, 14);
  }

  THEMES.push({
    id: 'boc',
    name: 'Code Bốc Lửa',
    dark: true,
    tint: '#ff7a33',
    alias: ['boc', 'code boc', 'boc lua', 'lua', 'chay', 'fire', 'burn', 'hacker'],
    glyphs: '{}()<>;=+*#$%01',
    bg(c, w, h) {
      vgrad(c, w, h, ['#0b0807', '#120b08', '#24100a']);
      rglow(c, w * 0.5, h * 1.05, Math.max(w, h) * 0.55, '#ff6a1f', 0.22);
      rglow(c, w * 0.15, h * 1.0, Math.max(w, h) * 0.3, '#d9472b', 0.12);
      rglow(c, w * 0.85, h * 1.0, Math.max(w, h) * 0.3, '#ff9a3d', 0.1);
    },
    init(w) {
      const s = w.s;
      s.seed = rint(1, 1e5);
      const n = Math.round(clamp((w.cols * w.rows) / 24, 12, 380));
      s.p = Array.from({ length: n }, () => {
        const p = {};
        bocSpawn(w, p, true);
        return p;
      });
      // Tia lửa: 1 ký tự sáng, bay nhanh, lắc mạnh.
      s.k = Array.from({ length: Math.round(clamp((w.cols * w.rows) / 160, 6, 70)) }, () => ({
        x: rnd(0, w.cols), y: rnd(0, w.rows), vy: rnd(6, 13), ph: rnd(0, 6.28), ch: '*·+\'`'[rint(0, 4)],
      }));
    },
    under(w) {
      // Lớp than ở đáy (tĩnh, vẽ một lần).
      const C = w.cols;
      const R = w.rows;
      const seed = w.s.seed;
      for (let x = 0; x < C; x++) {
        const hb = 1 + Math.round(1.2 + Math.sin(x * 0.17 + seed) * 0.8 + hash(x, 5, seed) * 1.2);
        for (let y = R - hb; y < R; y++) w.tile(x, y, '#2a120b', '#4a1d10', w.ch(x, y, 11));
      }
    },
    frame(w, dt) {
      const s = w.s;
      const t = w.t;
      const R = w.rows;
      const C = w.cols;
      // Than hồng nhấp nháy ở đáy.
      const tick = Math.floor(t * 9);
      for (let x = 0; x < C; x++) {
        const hb = 1 + Math.round(1.2 + Math.sin(x * 0.17 + s.seed) * 0.8 + hash(x, 5, s.seed) * 1.2);
        const k = hash(x, tick, s.seed);
        if (k < 0.55) continue;
        const y = R - 1 - ((hash(x, tick + 7, s.seed) * hb) | 0);
        const hot = k > 0.9;
        w.tile(x, y, hot ? '#7a2a10' : '#4d1a0c', hot ? '#ffd27a' : '#ff8a3d', w.ch(x, tick, 13), 0.35 + 0.65 * (k - 0.55) / 0.45);
      }
      // Quầng lửa phập phồng dọc đáy.
      for (let k = 0; k < 7; k++) {
        const gx = (C * (k + 0.5)) / 7 + Math.sin(t * 0.7 + k * 1.9) * 2;
        w.glow(gx, R - 1.5, Math.max(4, R * 0.16), '#ff5a14', 0.22 + 0.1 * Math.sin(t * (2.1 + k * 0.37) + k));
      }
      // Tia lửa.
      for (const k of s.k) {
        k.y -= k.vy * dt;
        if (k.y < R * 0.15 * (1 + Math.sin(k.ph))) {
          k.y = R - rnd(0, 2);
          k.x = rnd(0, C);
          k.vy = rnd(6, 13);
        }
        const f = 1 - k.y / R;
        const kx = k.x + Math.sin(t * 3 + k.ph) * 1.2;
        w.glow(kx, k.y, 1.4, '#ffb347', 0.35 * (1 - f));
        w.glyph(kx, k.y, k.ch, f < 0.4 ? '#fff1b8' : '#ffb347', 1 - f * 0.9);
      }
      // Code bốc lên.
      for (const p of s.p) {
        p.y -= p.vy * dt;
        p.age = (p.y0 - p.y) / p.maxH;
        if (p.age >= 1 || p.y < -1) {
          bocSpawn(w, p, false);
          continue;
        }
        const f = p.age;
        const x = p.x + Math.sin(t * p.wf + p.ph) * p.wa * (0.3 + f * 1.6);
        const flick = 0.8 + 0.2 * Math.sin(t * p.fl + p.ph);
        const a = Math.min(1, 1.15 * Math.pow(1 - f, 0.55) * flick);
        const col = bocColor(f);
        if (f < 0.4) w.glow(x + p.tok.length / 2, p.y, 1.8 + p.tok.length * 0.4, f < 0.15 ? '#ffb347' : '#ff6a1f', (0.4 - f) * 1.3);
        for (let i = 0; i < p.tok.length; i++) {
          const ch = p.tok[i];
          if (ch === ' ') continue;
          w.glyph(x + i, p.y, ch, col, a);
        }
      }
    },
  });

  /* ------------------------------------- custom: tắt "Tự đổi ngày/đêm" 1 lần */
  // Ô này bật thì cứ mỗi phút script ép theme về Sakura/Moonlit -> theme "tự nhảy".
  // Chỉ tắt đúng 1 lần (đoạn này chạy trước khi script đọc cài đặt); tick lại sau đó thì vẫn giữ.
  try {
    const K = 'pixel-themes:v1';
    if (!localStorage.getItem('pxt-custom:autocycle-off')) {
      const o = JSON.parse(localStorage.getItem(K) || '{}');
      if (o.autoCycle) {
        o.autoCycle = false;
        localStorage.setItem(K, JSON.stringify(o));
      }
      localStorage.setItem('pxt-custom:autocycle-off', '1');
    }
  } catch (e) {
    /* storage bị chặn: bỏ qua */
  }

  /* ------------------------------------ custom: mưa code khi Claude chạy task */
  // Khi ô chat có nút "Dừng"/"Stop" (Claude đang làm việc) -> code rơi phủ lên theme đang dùng,
  // hiện dần lên; task xong thì tắt dần. Chỉ vẽ trên hình nền chính, không vẽ ở ô xem trước theme.
  const RAIN = { on: false, force: null, k: 0, drops: null, cols: 0 };
  window.__pxtRain = RAIN; // gỡ lỗi: __pxtRain.force = true / false / null
  const RAIN_CHARS = '01{}[]()<>=+-*/;:$#%&|!?λアイウエオカキクケコサシスセソ';
  const STOP_SEL = 'button[aria-label="Dừng"],button[aria-label="Stop"],button[aria-label="Stop response"],button[aria-label="Stop generating"]';
  const isBusy = () => {
    for (const b of document.querySelectorAll(STOP_SEL)) {
      const r = b.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) return true;
    }
    return false;
  };
  setInterval(() => {
    RAIN.on = RAIN.force != null ? !!RAIN.force : isBusy();
  }, 400);

  function rainDrop(w, d, first) {
    d.y = first ? rnd(-w.rows, w.rows) : rnd(-w.rows * 0.6, -2);
    d.v = rnd(9, 22);
    d.len = rint(6, 20);
    d.s = rint(1, 1e5);
  }

  const _worldDraw = World.prototype.draw;
  World.prototype.draw = function (dt) {
    _worldDraw.call(this, dt);
    if (!this.fx || !this.th) return;
    RAIN.k = clamp(RAIN.k + (RAIN.on ? 1.2 : -0.8) * dt, 0, 1);
    if (RAIN.k <= 0.001) return;
    const C = this.cols;
    const R = this.rows;
    if (!RAIN.drops || RAIN.cols !== C) {
      RAIN.cols = C;
      RAIN.drops = Array.from({ length: C }, () => {
        const d = {};
        rainDrop(this, d, true);
        return d;
      });
    }
    const dark = !!this.th.dark;
    let trail = this.th.tint || (dark ? '#7dffb0' : '#2f6f8f');
    if (!dark) {
      // Theme sáng: màu theme quá nhạt thì mưa không thấy -> dùng xanh đậm.
      const n = parseInt(trail.slice(1), 16);
      const lum = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
      if (lum > 0.55) trail = '#2f6f8f';
    }
    const head = dark ? '#ffffff' : '#1d1714';
    const tq = Math.floor(this.t * 10);
    for (let x = 0; x < C; x++) {
      // Số cột có mưa tăng dần theo RAIN.k (hiện/tắt mượt), tối đa ~60% số cột.
      if (hash(x, 7, 99) > RAIN.k * 0.6) continue;
      const d = RAIN.drops[x];
      d.y += d.v * dt;
      if (d.y - d.len > R) rainDrop(this, d, false);
      const hy = Math.floor(d.y);
      for (let i = 0; i < d.len; i++) {
        const y = hy - i;
        if (y < 0 || y >= R) continue;
        const ch = RAIN_CHARS[(hash(x, y, d.s + (i === 0 ? tq : (tq >> 2))) * RAIN_CHARS.length) | 0];
        const f = i / d.len;
        const a = RAIN.k * (i === 0 ? 0.95 : 0.7 * Math.pow(1 - f, 1.4));
        if (i === 0) this.glow(x, y, 1.6, trail, 0.35 * RAIN.k);
        this.glyph(x, y, ch, i === 0 ? head : trail, a);
      }
    }
  };

