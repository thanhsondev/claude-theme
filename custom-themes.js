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

  // Thứ tự vẽ: hình nền -> mưa code -> nền tối sau cột chữ -> bot/đống tuyết (afterFx).
  // Mưa nằm DƯỚI nền tối nên không còn đè lên chữ Claude trả lời.
  const _worldDraw = World.prototype.draw;
  World.prototype.draw = function (dt) {
    const af = this.afterFx;
    this.afterFx = null;
    try {
      _worldDraw.call(this, dt);
    } finally {
      this.afterFx = af;
    }
    if (this.fx && this.th) {
      drawRain(this, dt);
      drawTextBackdrop(this);
    }
    if (af) af(this, dt);
  };

  /* Nền tối nhẹ sau cột chữ (transcript): dải bo góc, mép mờ dần, cùng bề ngang ô nhập chat.
     Bật/tắt + độ đậm ở ô "Nền tối sau chữ" trong Alt+T (cfg.textBg, mặc định 0.5). */
  function drawTextBackdrop(w) {
    const col = w.col;
    const k = cfg.textBg == null ? 0.5 : +cfg.textBg;
    if (!col || k <= 0.01 || cfg.textBgOn === false) return;
    const ctx = w.ctx;
    const dark = lookDark();
    const rgb = dark ? '8, 9, 14' : '255, 253, 249';
    const pad = 10;
    const x0 = col.x - pad;
    const x1 = col.x + col.w + pad;
    const fe = 28; // mép mờ
    const g = ctx.createLinearGradient(x0 - fe, 0, x1 + fe, 0);
    const span = x1 - x0 + fe * 2;
    g.addColorStop(0, `rgba(${rgb},0)`);
    g.addColorStop(fe / span, `rgba(${rgb},${k})`);
    g.addColorStop(1 - fe / span, `rgba(${rgb},${k})`);
    g.addColorStop(1, `rgba(${rgb},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(x0 - fe, 0, x1 - x0 + fe * 2, w.h);
  }

  function drawRain(w, dt) {
    RAIN.k = clamp(RAIN.k + (RAIN.on ? 1.2 : -0.8) * dt, 0, 1);
    if (RAIN.k <= 0.001) return;
    const C = w.cols;
    const R = w.rows;
    if (!RAIN.drops || RAIN.cols !== C) {
      RAIN.cols = C;
      RAIN.drops = Array.from({ length: C }, () => {
        const d = {};
        rainDrop(w, d, true);
        return d;
      });
    }
    const dark = !!w.th.dark;
    let trail = w.th.tint || (dark ? '#7dffb0' : '#2f6f8f');
    if (!dark) {
      // Theme sáng: màu theme quá nhạt thì mưa không thấy -> dùng xanh đậm.
      const n = parseInt(trail.slice(1), 16);
      const lum = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
      if (lum > 0.55) trail = '#2f6f8f';
    }
    const head = dark ? '#ffffff' : '#1d1714';
    const tq = Math.floor(w.t * 10);
    for (let x = 0; x < C; x++) {
      // Số cột có mưa tăng dần theo RAIN.k (hiện/tắt mượt), tối đa ~60% số cột.
      if (hash(x, 7, 99) > RAIN.k * 0.6) continue;
      const d = RAIN.drops[x];
      d.y += d.v * dt;
      if (d.y - d.len > R) rainDrop(w, d, false);
      const hy = Math.floor(d.y);
      for (let i = 0; i < d.len; i++) {
        const y = hy - i;
        if (y < 0 || y >= R) continue;
        const ch = RAIN_CHARS[(hash(x, y, d.s + (i === 0 ? tq : (tq >> 2))) * RAIN_CHARS.length) | 0];
        const f = i / d.len;
        const a = RAIN.k * (i === 0 ? 0.95 : 0.7 * Math.pow(1 - f, 1.4));
        if (i === 0) w.glow(x, y, 1.6, trail, 0.35 * RAIN.k);
        w.glyph(x, y, ch, i === 0 ? head : trail, a);
      }
    }
  };

  /* --------------------------------------------------- custom: Giáng Sinh */
  // Đêm tuyết: trăng, đồi xa, rừng thông giăng đèn nhấp nháy, tuyết rơi 3 lớp (né chuột);
  // xe trượt ông già Noel do tuần lộc kéo bay ngang màn hình, lúc sang phải lúc sang trái.
  // Ở theme này bot Claude đội nón Noel và có nhạc nền tự tổng hợp (ô "Nhạc Giáng Sinh" trong Alt+T).

  const XM_LIGHTS = ['#ff4d5e', '#ffd34d', '#4dc3ff', '#7dff8a', '#ff8af0'];
  const xmDeer = (legs) => ({
    w: 9,
    h: 6,
    rows: ['    Y  Y ', '     YY  ', '     HeHN', 'TBBBBBH  ', ' BBBBBB  ', legs],
    pal: {
      Y: ['#eadbb4', '#b89c66', ''],
      H: ['#a8703f', '#6e4421', ''],
      e: ['#1a120c', null, ''],
      N: ['#2b1a10', null, ''],
      B: ['#8a5530', '#c08a5a', '.'],
      T: ['#f3ece0', '#c9bda8', ''],
      L: ['#5b3a20', null, ''],
    },
  });
  const XM_DEER = [xmDeer(' L L L L '), xmDeer('L L   L L')];
  const XM_SLEIGH = {
    w: 11,
    h: 8,
    rows: ['   WRRR    ', '    RRRR   ', ' PP SSeS   ', 'PPPPWWWW  D', 'DDDDRRRRDDD', 'DDDDDDDDDD ', ' DDDDDDDD G', '  GGGGGGGG '],
    pal: {
      W: ['#ffffff', '#c9d6e8', '*'],
      R: ['#d62f3a', '#8f1720', ''],
      S: ['#f5c6a5', '#c99270', ''],
      e: ['#1a120c', null, ''],
      P: ['#2f8a4a', '#ffd34d', '+'],
      D: ['#b3202b', '#ffd34d', ''],
      G: ['#ffd34d', '#b88a1c', ''],
    },
  };

  // Bố cục tĩnh (mặt tuyết, đồi, cây, đèn) theo kích thước lưới; tính lại khi cửa sổ đổi cỡ.
  function xmLayout(w) {
    const s = w.s;
    const C = w.cols;
    const R = w.rows;
    const key = C + 'x' + R;
    if (s.key === key) return s;
    s.key = key;
    const gh = Math.max(2, Math.round(R * 0.08));
    s.ground = Array.from({ length: C }, (_, x) => R - gh + Math.round(Math.sin(x * 0.09 + 1.3) * 0.9 + Math.sin(x * 0.031) * 1.2));
    s.hill = Array.from({ length: C }, (_, x) => R - gh - 1 - Math.round(Math.abs(Math.sin(x * 0.045 + 0.7)) * R * 0.09 + Math.sin(x * 0.17) * 0.8));
    s.moon = { x: Math.round(C * 0.8), y: Math.round(clamp(R * 0.15, 3, 12)), r: clamp(Math.round(R * 0.055), 1, 4) };
    s.stars = Array.from({ length: Math.round(clamp((C * R) / 70, 8, 160)) }, () => ({ x: rint(0, C - 1), y: rint(0, Math.round(R * 0.55)), ph: rnd(0, 6.28), f: rnd(0.6, 2.2) }));
    // Cây: 2 cây lớn ở hai mép, cây nhỏ rải giữa. Vẽ cây thấp trước để cây cao đè lên.
    const trees = [];
    const used = new Uint8Array(C);
    const place = (cx, h) => {
      cx = clamp(cx, 1, C - 2);
      for (let x = cx - 2; x <= cx + 2; x++) if (x >= 0 && x < C && used[x]) return;
      for (let x = cx - 2; x <= cx + 2; x++) if (x >= 0 && x < C) used[x] = 1;
      trees.push({ cx, h, base: s.ground[cx] });
    };
    place(Math.round(C * 0.07), Math.round(clamp(R * 0.36, 5, 26)));
    place(C - 1 - Math.round(C * 0.08), Math.round(clamp(R * 0.3, 4, 22)));
    for (let i = 0; i < C / 7; i++) place(rint(0, C - 1), rint(3, Math.max(4, Math.round(R * 0.17))));
    trees.sort((a, b) => a.h - b.h);
    s.lights = [];
    for (const t of trees) {
      t.trunk = t.h >= 10 ? 2 : 1;
      t.tl = Math.max(3, Math.round(t.h / 3));
      t.top = t.base - t.trunk - t.h;
      t.half = (i) => Math.round((i % t.tl) * 0.8 + Math.floor(i / t.tl) * 1.3 + (i ? 0.4 : 0));
      for (let i = 1; i < t.h; i++) {
        const hf = t.half(i);
        for (let dx = -hf; dx <= hf; dx++) {
          if (((dx + i * 2) % 4 + 4) % 4 || hash(t.cx + dx, i, 3) > 0.6) continue;
          s.lights.push({ x: t.cx + dx, y: t.top + i, c: XM_LIGHTS[(i + dx + 50) % XM_LIGHTS.length], ph: rnd(0, 6.28) });
        }
      }
    }
    s.trees = trees;
    return s;
  }

  function xmFlake(w, top) {
    const z = Math.random();
    const l = z < 0.5 ? 0 : z < 0.85 ? 1 : 2;
    return {
      x: rnd(-4, w.cols + 4),
      y: top ? rnd(-6, -1) : rnd(0, w.rows),
      l,
      vy: [1.3, 2.4, 4][l] * rnd(0.8, 1.2),
      ph: rnd(0, 6.28),
      sw: rnd(0.3, 0.9) * (l + 1) * 0.6,
      f: rnd(0.4, 1.1),
    };
  }

  // Xe trượt + tuần lộc lượn tự do trên bầu trời. Con đầu đàn tự chọn điểm đến (đôi khi là chỗ
  // con trỏ chuột), rẽ cua mềm; cả đoàn nối đuôi đi đúng vệt đường của con đầu đàn (giống đoàn tàu),
  // mỗi con tự quay mặt theo hướng nó đang đi. Lâu lâu ông già Noel hô "hô hô hô", chuông reng xen kẽ.
  function xmSleigh(w, s, dt, t) {
    const sl = s.sl;
    const C = w.cols;
    const R = w.rows;
    const n = C >= 110 ? 4 : C >= 70 ? 3 : C >= 40 ? 2 : 1;
    const GAP = 10;
    const DS = 3 + (n - 1) * GAP + 12; // khoảng cách từ tâm con đầu đàn tới tâm xe
    const TOTAL = DS + 8;
    const xMin = 6;
    const xMax = Math.max(xMin + 4, C - 6);
    const yMin = 5;
    const yMax = Math.max(yMin + 4, Math.round(R * 0.66));
    if (w.fx) XM.sl = sl; // gỡ lỗi: __pxtXmas.sl.hoT = 0 -> hô ngay; .bellT = 0 -> reng ngay
    if (!sl.path) {
      sl.x = w.fx ? -3 : C * 0.85;
      sl.y = clamp(R * 0.32, yMin, yMax);
      sl.a = 0;
      sl.path = [];
      for (let d = TOTAL + 6; d >= 0; d -= 0.5) sl.path.push({ x: sl.x - d, y: sl.y });
      sl.wx = rnd(C * 0.3, C * 0.7);
      sl.wy = rnd(yMin, yMax);
      sl.faces = [];
      sl.hoT = rnd(6, 12);
      sl.bellT = rnd(2, 5);
      sl.sayT = 0;
    }
    if (w.fx) {
      const ms = w.mouse;
      sl.wt = (sl.wt || 0) + dt;
      if (Math.hypot(sl.wx - sl.x, sl.wy - sl.y) < 5 || sl.wt > 9 || sl.wx > xMax + 2 || sl.wy > yMax + 2) {
        sl.wt = 0;
        if (ms && ms.active && Math.random() < 0.25) {
          sl.wx = clamp(ms.x, xMin, xMax);
          sl.wy = clamp(ms.y, yMin, yMax);
        } else {
          sl.wx = rnd(xMin, xMax);
          sl.wy = rnd(yMin, yMax);
        }
      }
      const want = Math.atan2(sl.wy - sl.y, sl.wx - sl.x);
      const da = ((((want - sl.a) % 6.2832) + 9.4248) % 6.2832) - 3.1416;
      sl.a += clamp(da, -1.5 * dt, 1.5 * dt);
      const v = clamp(C / 11, 6, 13) * (cfg.speed || 1);
      sl.x += Math.cos(sl.a) * v * dt;
      sl.y += Math.sin(sl.a) * v * dt * 0.75;
      sl.path.push({ x: sl.x, y: sl.y });
    }
    // Độ dài cộng dồn tính từ đầu đàn ra sau; cắt bỏ phần vệt đã quá dài.
    const P = sl.path;
    const cum = new Float32Array(P.length);
    for (let i = P.length - 2; i >= 0; i--) cum[i] = cum[i + 1] + Math.hypot(P[i + 1].x - P[i].x, P[i + 1].y - P[i].y);
    let cut = 0;
    while (cut < P.length - 2 && cum[cut + 1] > TOTAL + 4) cut++;
    const base = cut;
    // Điểm trên vệt cách đầu đàn d ô.
    const at = (d) => {
      for (let i = P.length - 1; i > base; i--) {
        if (cum[i - 1] >= d) {
          const span = cum[i - 1] - cum[i] || 1;
          const f = (d - cum[i]) / span;
          return { x: P[i].x + (P[i - 1].x - P[i].x) * f, y: P[i].y + (P[i - 1].y - P[i].y) * f };
        }
      }
      return { x: P[base].x, y: P[base].y };
    };
    if (cut > 50) {
      sl.path = P.slice(cut);
    }
    // Hướng mặt: so điểm phía trước với phía sau; đi gần như thẳng đứng thì giữ hướng cũ.
    const face = (k, d) => {
      const f = at(Math.max(0, d - 1.5));
      const b = at(d + 1.5);
      const dx = f.x - b.x;
      if (Math.abs(dx) > 0.4) sl.faces[k] = dx > 0 ? 1 : -1;
      return sl.faces[k] || 1;
    };
    // Dây cương vàng chạy theo vệt, từ ngực con đầu đàn tới đầu xe.
    for (let d = 4; d < DS - 6; d += 0.9) {
      const p = at(d);
      w.glyph(p.x, p.y, '-', '#ffd34d', 0.85);
    }
    for (let k = n - 1; k >= 0; k--) {
      const d = 3 + k * GAP;
      const p = at(d);
      const f = face(k, d);
      const bob = Math.sin(t * 9 + k * 1.3) * 0.6;
      w.sprite(XM_DEER[Math.floor(t * 8 + k) % 2], p.x - 4.5, p.y - 3 + bob, { flip: f < 0 });
    }
    const sp = at(DS);
    const sf = face(n, DS);
    const sx = Math.round(sp.x - XM_SLEIGH.w / 2);
    const sy = Math.round(sp.y - 4 + Math.sin(t * 3) * 0.4);
    w.glow(sx + 5, sy + 4, 7, '#ffd9a0', 0.2);
    w.sprite(XM_SLEIGH, sx, sy, { flip: sf < 0 });
    const onScreen = sx > 0 && sx + XM_SLEIGH.w < C && sy > 2 && sy < R;
    if (w.fx) {
      sl.hoT -= dt;
      sl.bellT -= dt;
      if (sl.hoT <= 0 && onScreen && !xmSfxBusy()) {
        sl.hoT = rnd(20, 45);
        sl.sayT = 2.6;
        sl.bellT = Math.max(sl.bellT, 4);
        xmSfx('ho');
        BOT_TALK.reply = 1.8; // bot Claude hô theo
      }
      if (sl.bellT <= 0 && sl.sayT <= 0 && !xmSfxBusy()) {
        sl.bellT = rnd(15, 35);
        xmSfx('ring');
      }
    }
    if (sl.sayT > 0) {
      sl.sayT -= dt;
      const cell = w.cell;
      xmBubble(w, (sx + (sf < 0 ? 4.5 : 5.5)) * cell, sy * cell - 2, 'Hô hô hô!', Math.min(1, sl.sayT / 0.4));
    }
    // Bụi sao rắc ra sau xe.
    if (w.fx && Math.random() < 0.7) {
      const bp = at(DS + 6.5);
      s.trail.push({ x: bp.x + rnd(-0.5, 0.5), y: bp.y + rnd(-1, 3), a: 1, ch: pick(['*', '+', '.', '*']) });
    }
  }

  THEMES.push({
    id: 'xmas',
    name: 'Giáng Sinh',
    dark: true,
    tint: '#9fd8ff',
    veilScale: 0.8,
    alias: ['xmas', 'noel', 'giang sinh', 'giangsinh', 'christmas', 'santa', 'tuyet', 'snow', 'tuan loc'],
    glyphs: '*+.^',
    bg(c, w, h) {
      vgrad(c, w, h, ['#060b1f', '#0e1a3d', '#1d2f5c', '#2c4372']);
      rglow(c, w * 0.8, h * 0.15, Math.max(w, h) * 0.32, '#cfe2ff', 0.22);
      rglow(c, w * 0.5, h * 1.05, Math.max(w, h) * 0.6, '#6fa8ff', 0.16);
    },
    under(w) {
      const s = xmLayout(w);
      const C = w.cols;
      const R = w.rows;
      // Trăng.
      const m = s.moon;
      for (let y = -m.r; y <= m.r; y++)
        for (let x = -m.r; x <= m.r; x++) {
          if (x * x + y * y > m.r * m.r + 0.6) continue;
          w.tile(m.x + x, m.y + y, '#f6f1d8', '#d8cfa8', hash(x, y, 9) < 0.25 ? 'o' : '', 0.97);
        }
      // Đồi xa phủ tuyết.
      for (let x = 0; x < C; x++)
        for (let y = s.hill[x]; y < R; y++) w.tile(x, y, y === s.hill[x] ? '#9fb6d8' : '#22345a', '#6d86b0', y === s.hill[x] ? '*' : '', 0.9);
      // Cây thông.
      for (const t of s.trees) {
        for (let k = 0; k < t.trunk; k++) w.tile(t.cx, t.base - 1 - k, '#5a3a22', '#3b2414', '|');
        for (let i = 0; i < t.h; i++) {
          const hf = t.half(i);
          const j = i % t.tl;
          for (let dx = -hf; dx <= hf; dx++) {
            const x = t.cx + dx;
            const y = t.top + i;
            const edge = Math.abs(dx) === hf;
            const snow = i === 0 || (j === 0 && edge) || (edge && hash(x, y, 5) < 0.45) || hash(x, y, 6) < 0.07;
            if (snow) w.tile(x, y, '#eef5ff', '#b9cde6', '*');
            else w.tile(x, y, dx > 0 ? '#17543a' : '#1f6b45', '#2f8f5c', '^');
          }
        }
      }
      // Mặt tuyết.
      for (let x = 0; x < C; x++)
        for (let y = s.ground[x]; y < R; y++) {
          const top = y === s.ground[x];
          w.tile(x, y, top ? '#f4f8ff' : '#dbe6f7', top ? '#c9d8ee' : '#ffffff', top ? '~' : hash(x, y, 8) < 0.12 ? '*' : '');
        }
    },
    init(w) {
      const s = w.s;
      s.key = null;
      s.flakes = Array.from({ length: Math.round(clamp((w.cols * w.rows) / 16, 40, 420) * (cfg.density || 1)) }, () => xmFlake(w, false));
      s.sl = {};
      s.trail = [];
    },
    frame(w, dt) {
      const s = xmLayout(w);
      const t = w.t;
      const C = w.cols;
      const R = w.rows;
      for (const st of s.stars) {
        const a = 0.25 + 0.55 * (0.5 + 0.5 * Math.sin(t * st.f + st.ph));
        w.glyph(st.x, st.y, a > 0.68 ? '+' : '.', '#e8f0ff', a);
      }
      // Ngôi sao trên ngọn cây + đèn nhấp nháy.
      for (const tr of s.trees) {
        if (tr.h < 6) continue;
        w.glow(tr.cx, tr.top - 1, 2.6, '#ffd34d', 0.4 + 0.15 * Math.sin(t * 2 + tr.cx));
        w.tile(tr.cx, tr.top - 1, '#ffd34d', '#fff6c2', '*');
      }
      for (const L of s.lights) {
        const v = Math.sin(t * 2.4 + L.ph);
        if (v < -0.3) continue;
        const a = 0.55 + 0.45 * v;
        w.glow(L.x, L.y, 1.5, L.c, 0.3 * a);
        w.tile(L.x, L.y, L.c, '#ffffff', 'o', a);
      }
      xmSleigh(w, s, dt, t);
      for (let i = s.trail.length - 1; i >= 0; i--) {
        const p = s.trail[i];
        p.a -= dt * 0.9;
        p.y += dt * 1.2;
        if (p.a <= 0) s.trail.splice(i, 1);
        else w.glyph(p.x, p.y, p.ch, '#ffe08a', p.a);
      }
      // Tuyết rơi: xa (chấm nhỏ), giữa (·), gần (*). Gió đổi chiều chậm, chuột thổi tuyết dạt ra.
      const sp = cfg.speed || 1;
      if (w.fx) xmPileUpdate(w, dt);
      const wind = Math.sin(t * 0.13) * 0.8 + Math.sin(t * 0.47) * 0.3;
      const ms = w.mouse;
      const hasMouse = ms && ms.active;
      for (let i = 0; i < s.flakes.length; i++) {
        const p = s.flakes[i];
        p.y += p.vy * sp * dt;
        p.x += (wind * (p.l + 1) * 0.5 + Math.sin(t * p.f + p.ph) * p.sw) * sp * dt;
        if (hasMouse) {
          const dx = p.x - ms.x;
          const dy = p.y - ms.y;
          const dist = Math.hypot(dx, dy);
          if (dist < 8) {
            const f = (1 - dist / 8) * 10 * dt;
            p.x += (dx / (dist + 0.1)) * f + ms.vx * 0.3 * dt;
            p.y += (dy / (dist + 0.1)) * f;
          }
        }
        if (w.fx && PILE.on && p.l > 0) {
          const px = p.x * w.cell;
          const py = (p.y + 0.5) * w.cell;
          if (px >= PILE.left && px < PILE.left + PILE.width && py >= PILE.top - xmPileH(px) - 2 && py <= PILE.top + 6) {
            xmPileAdd(px, p.l === 2 ? 2.4 : 1.2);
            s.flakes[i] = xmFlake(w, true);
            continue;
          }
        }
        const gx = clamp(Math.round(p.x), 0, C - 1);
        if (p.y > (p.l === 2 ? s.ground[gx] : R) || p.x < -6 || p.x > C + 6) {
          s.flakes[i] = xmFlake(w, true);
          continue;
        }
        if (p.l === 0) w.dot(p.x, p.y, '#dfe9ff', 0.5, 0.2);
        else if (p.l === 1) w.glyph(p.x, p.y, '·', '#eef4ff', 0.75);
        else w.glyph(p.x, p.y, '*', '#ffffff', 0.95);
      }
    },
  });

  /* --------------------------------------------- custom: bot đi tự do khắp cửa sổ */
  // Bot không chỉ đứng trên ô chat nữa: tự đi tới chỗ bất kỳ trong cửa sổ, lúc thì về đậu trên
  // ô chat, lúc chạy tới chỗ con trỏ chuột, lúc nhảy tại chỗ. Đi dọc thì giơ tay như đang bay.
  // Rê chuột lại gần hoặc gõ phím thì bot nhảy. Tắt ô "Bot đi tự do" trong Alt+T để về kiểu cũ.
  const FB = { x: null, y: null, tx: 0, ty: 0, mode: 'idle', timer: 1.2, hopT: 0, step: 0, blink: 3, perch: true, px: 0 };
  window.__pxtBot = FB; // gỡ lỗi
  const _botFrameOrig = botFrame;
  botFrame = function (w, dt) {
    if (cfg.botFree === false) return _botFrameOrig(w, dt);
    if (!cfg.bot || curId === 'off') return;
    const b = layout.box;
    const bs = clamp(Math.round(w.cell * 0.82), 9, 12);
    const W = 11 * bs;
    const H = 5 * bs;
    const minX = 8;
    const maxX = Math.max(minX, w.w - W - 8);
    const minY = 44 + bs * 4; // chừa chỗ cho nón Noel + bong bóng thoại
    const maxY = Math.max(minY, w.h - H - 8);
    const perchY = b ? b.top - H - 3 : maxY;
    const perchX = () => (b ? rnd(b.left + 12, Math.max(b.left + 12, b.right - W - 12)) : rnd(minX, maxX));
    if (FB.x == null) {
      FB.x = b ? Math.max(b.left + 12, b.right - W - 12) : maxX;
      FB.y = perchY;
    }
    const sp = cfg.speed || 1;
    const mx = mouse.x;
    const my = mouse.y;
    const near = mouse.active && Math.abs(mx - (FB.x + W / 2)) < W && Math.abs(my - (FB.y + H / 2)) < H * 1.5;
    const sweeping = FB.mode === 'sweep' || FB.next === 'sweep';
    if ((bot.poke || near) && FB.mode !== 'hop' && !sweeping) {
      FB.mode = 'hop';
      FB.hopT = 0;
    }
    bot.poke = false;
    FB.timer -= dt;
    // Tuyết đọng dày trên ô chat -> vác chổi ra đầu trái ô chat rồi quét sang phải.
    if (PILE.need && b && !sweeping && FB.mode !== 'hop') {
      FB.mode = 'walk';
      FB.next = 'sweep';
      FB.perch = true;
      FB.tx = b.left + 12;
      FB.ty = perchY;
      try {
        botSay('Để tui quét tuyết!', 2.5);
      } catch (e) {
        /* chưa có phần nói chuyện */
      }
    }
    if (FB.mode === 'idle' && FB.timer <= 0) {
      const r = Math.random();
      if (r < 0.45) {
        FB.mode = 'walk';
        FB.perch = false;
        FB.tx = rnd(minX, maxX);
        FB.ty = rnd(minY, maxY);
      } else if (r < 0.68 && b) {
        FB.mode = 'walk';
        FB.perch = true;
        FB.tx = perchX();
        FB.ty = perchY;
      } else if (r < 0.8 && mouse.active) {
        // Chạy tới thăm con trỏ chuột, dừng cạnh chứ không đè lên.
        FB.mode = 'walk';
        FB.perch = false;
        FB.tx = mx + (mx > w.w / 2 ? -W - 24 : 24);
        FB.ty = my - H / 2;
      } else if (r < 0.92) {
        FB.mode = 'hop';
        FB.hopT = 0;
      }
      FB.timer = rnd(1.5, 4.5);
    }
    // Đang đậu trên ô chat thì bám theo khi ô chat dịch chuyển/đổi cỡ.
    if (FB.perch && b && FB.mode !== 'walk') {
      FB.y = perchY;
      FB.x = clamp(FB.x, b.left + 12, Math.max(b.left + 12, b.right - W - 12));
    }
    let lift = 0;
    let rows = BOT_ROWS.walkA;
    if (FB.mode === 'walk') {
      if (FB.perch) FB.ty = perchY;
      FB.tx = clamp(FB.tx, minX, maxX);
      FB.ty = clamp(FB.ty, minY, Math.max(maxY, perchY));
      const dx = FB.tx - FB.x;
      const dy = FB.ty - FB.y;
      const dist = Math.hypot(dx, dy);
      const v = (Math.abs(dy) > Math.abs(dx) ? 95 : 75) * sp * dt;
      if (Math.abs(dx) > 2) bot.look = dx > 0 ? 1 : -1;
      if (dist <= v) {
        FB.x = FB.tx;
        FB.y = FB.ty;
        FB.mode = FB.next === 'sweep' ? 'sweep' : 'idle';
        FB.next = null;
      } else {
        FB.x += (dx / dist) * v;
        FB.y += (dy / dist) * v;
      }
      FB.step += dt;
      // Đi dọc/chéo nhiều: giơ tay "bay"; đi ngang: bước chân.
      if (Math.abs(dy) > Math.abs(dx) * 0.6) {
        rows = BOT_ROWS.hop;
        lift = Math.sin(FB.step * 10) * bs * 0.25;
      } else rows = Math.floor(FB.step / 0.16) % 2 ? BOT_ROWS.walkB : BOT_ROWS.walkA;
    } else if (FB.mode === 'sweep') {
      bot.look = 1;
      FB.perch = true;
      FB.y = perchY;
      FB.x += 42 * sp * dt;
      FB.step += dt;
      rows = Math.floor(FB.step / 0.22) % 2 ? BOT_ROWS.walkB : BOT_ROWS.walkA;
      if (b) xmPileSweep(b.left - 10, FB.x + W + bs * 3.5, dt);
      if (!b || FB.x >= b.right - W - 12) {
        if (b) xmPileSweep(b.left - 10, b.right + 10, 99);
        FB.mode = 'idle';
        FB.timer = rnd(2, 4);
        PILE.need = false;
        try {
          botSay(pick(['Sạch bóng!', 'Xong, sạch trơn!', 'Gọn gàng chưa?']), 2.5);
        } catch (e) {
          /* chưa có phần nói chuyện */
        }
      }
    } else if (FB.mode === 'hop') {
      FB.hopT += dt;
      const T = 0.5;
      lift = Math.sin(Math.PI * Math.min(1, FB.hopT / T)) * bs * 2;
      rows = FB.hopT < T * 0.8 ? BOT_ROWS.hop : BOT_ROWS.walkA;
      if (FB.hopT >= T) FB.mode = 'idle';
    } else {
      lift = (Math.sin(w.t * 3) + 1) * 0.6;
      if (mouse.active) bot.look = mx > FB.x + W / 2 ? 1 : -1;
    }
    FB.x = clamp(FB.x, minX, maxX);
    FB.y = clamp(FB.y, minY, Math.max(maxY, perchY));
    bot.x = FB.x; // để debug() của script gốc báo đúng vị trí
    FB.blink -= dt;
    const blinking = FB.blink < 0.14;
    if (FB.blink < 0) FB.blink = rnd(2.2, 5);
    const x0 = Math.round(FB.x);
    const y0 = Math.round(FB.y - lift);
    const ctx = w.ctx;
    // Bóng dưới chân: đậm khi đứng trên ô chat, nhạt khi đang "lơ lửng" giữa màn hình.
    const onBox = FB.perch && b && Math.abs(FB.y - perchY) < 2;
    ctx.globalAlpha = (onBox ? 0.28 : 0.16) * (1 - Math.min(1, lift / (bs * 3)));
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(x0 + W / 2, Math.round(FB.y) + H + 2, W * 0.38, bs * 0.45, 0, 0, Math.PI * 2);
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
    const ey = y0 + bs;
    for (const c of [3, 7]) {
      const ex = x0 + (c + bot.look) * bs;
      if (blinking) {
        ctx.fillStyle = BOT_PAL.e[0];
        ctx.fillRect(ex + bs * 0.15, ey + bs * 0.45, bs * 0.7, bs * 0.18);
      } else w.tileAt(ex, ey, bs, BOT_PAL.e[0], null, '');
    }
    // Cây chổi: lúc vác đi thì dựng đứng sau lưng, lúc quét thì chĩa xuống trước mặt và đưa qua lại.
    if (FB.mode === 'sweep' || FB.next === 'sweep') xmBroom(w, x0, y0, bs, FB.mode === 'sweep', bot.look);
  };

  function xmBroom(w, x0, y0, bs, active, look) {
    const ctx = w.ctx;
    const dir = look < 0 ? -1 : 1;
    const ox = dir > 0 ? x0 : x0 + 11 * bs; // mép trước của bot
    const hx = (i) => (dir > 0 ? ox + i * bs : ox - (i + 1) * bs);
    if (active) {
      const osc = Math.sin(w.t * 16) * bs * 0.45;
      w.tileAt(hx(9.6), y0 + bs * 1.2, bs * 0.8, '#8b5a2b', null, '');
      w.tileAt(hx(10.4) + osc * 0.3, y0 + bs * 2.1, bs * 0.8, '#8b5a2b', null, '');
      w.tileAt(hx(11.2) + osc * 0.6, y0 + bs * 3.0, bs * 0.8, '#7a4b22', null, '');
      for (let k = 0; k < 3; k++) w.tileAt(hx(11 + k) + osc, y0 + bs * 4, bs, '#e8c25a', '#a8822a', '|');
    } else {
      const bx = dir > 0 ? x0 - bs * 0.6 : x0 + 11 * bs - bs * 0.4;
      for (let k = 0; k < 4; k++) w.tileAt(bx, y0 - bs * (k - 3.2), bs * 0.8, '#8b5a2b', null, '');
      for (let k = 0; k < 3; k++) w.tileAt(bx - bs + k * bs * 0.9, y0 - bs * 2, bs * 0.9, '#e8c25a', '#a8822a', '|');
    }
    ctx.globalAlpha = 1;
  }

  /* Nón Noel cho bot Claude (chỉ ở theme Giáng Sinh). Không đụng vào hàm vẽ bot gốc: bắt vị trí
     các ô hàng đầu (màu H) mà bot vừa vẽ, rồi vẽ nón ngay phía trên. Nón ngả ra sau lưng bot. */
  const XM_HAT = ['WR     ', ' RRR   ', ' RRRRR ', 'WWWWWWW'];
  const XM_HAT_PAL = { R: ['#d62f3a', '#8f1720', ''], W: ['#ffffff', '#c9d6e8', '*'] };
  const _botFrame = botFrame;
  botFrame = function (w, dt) {
    if (curId !== 'xmas') return _botFrame(w, dt);
    let x0 = Infinity;
    let x1 = -Infinity;
    let y0 = null;
    let bs = 0;
    const headBg = BOT_PAL.H[0];
    const orig = w.tileAt;
    w.tileAt = function (px, py, size, bg, ...rest) {
      if (bg === headBg) {
        x0 = Math.min(x0, px);
        x1 = Math.max(x1, px);
        if (y0 == null || py < y0) y0 = py;
        bs = size;
      }
      return orig.call(this, px, py, size, bg, ...rest);
    };
    try {
      _botFrame(w, dt);
    } finally {
      delete w.tileAt;
    }
    if (y0 == null || !bs) return;
    const back = bot.look < 0; // bot nhìn sang trái thì nón ngả sang phải
    const cols = Math.round((x1 - x0) / bs) + 1;
    for (let j = 0; j < XM_HAT.length; j++) {
      const row = XM_HAT[j];
      for (let i = 0; i < row.length && i < cols; i++) {
        const p = XM_HAT_PAL[row[i]];
        if (!p) continue;
        const ci = back ? cols - 1 - i : i;
        w.tileAt(x0 + ci * bs, y0 - (XM_HAT.length - j) * bs, bs, p[0], p[1], p[2]);
      }
    }
  };

  /* Nhạc nền Giáng Sinh: "Jingle Bells" (Pierpont, 1857) và "We Wish You a Merry Christmas"
     (dân ca Anh) — cả hai đã thuộc phạm vi công cộng. Tổng hợp bằng WebAudio, không tải gì. */
  const xmHz = (n) => {
    const m = /^([A-G])(#?)(\d)$/.exec(n);
    const st = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1]] + (m[2] ? 1 : 0) + (+m[3] + 1) * 12;
    return 440 * Math.pow(2, (st - 69) / 12);
  };
  const midiHz = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const XM_ROOT = { C: 48, D: 50, E: 52, F: 53, G: 43, A: 45, B: 47 };
  function xmSong(def) {
    const ev = [];
    let tt = 0;
    for (const tok of def.mel.split(/\s+/)) {
      if (!tok || tok === '|') continue;
      const [n, b] = tok.split(':');
      if (n !== '-') ev.push({ t: tt, d: +b, f: xmHz(n) * Math.pow(2, (def.shift || 0) / 12), k: 0, w: def.wave || 'square' });
      tt += +b;
    }
    const bpb = def.bpb;
    def.chords.split(' ').forEach((ch, i) => {
      const t0 = (def.pickup || 0) + i * bpb;
      const r = XM_ROOT[ch];
      for (let b = 0; b < bpb; b++) {
        ev.push({ t: t0 + b, d: 0.85, f: midiHz(r + (b === 0 ? 0 : bpb === 3 || b % 2 ? 7 : 12)), k: 1 });
        if (bpb === 4 || b === 0) ev.push({ t: t0 + b, k: 2, v: b % 2 ? 1 : 0.6 });
        if (bpb === 4) ev.push({ t: t0 + b + 0.5, k: 2, v: 0.35 });
      }
    });
    ev.sort((a, b) => a.t - b.t);
    return { ev, len: tt, spb: 60 / def.bpm, name: def.name };
  }
  const XM_SONGS = [
    xmSong({
      name: 'Jingle Bells',
      bpm: 168,
      bpb: 4,
      mel:
        'G4:1 E5:1 D5:1 C5:1 | G4:3 G4:0.5 G4:0.5 | G4:1 E5:1 D5:1 C5:1 | A4:4 | A4:1 F5:1 E5:1 D5:1 | B4:4 | G5:1 G5:1 F5:1 D5:1 | E5:4 |' +
        ' G4:1 E5:1 D5:1 C5:1 | G4:4 | G4:1 E5:1 D5:1 C5:1 | A4:3 A4:1 | A4:1 F5:1 E5:1 D5:1 | G5:1 G5:1 G5:1 G5:1 | A5:1 G5:1 F5:1 D5:1 | C5:2 -:2 |' +
        ' E5:1 E5:1 E5:2 | E5:1 E5:1 E5:2 | E5:1 G5:1 C5:1.5 D5:0.5 | E5:4 | F5:1 F5:1 F5:1.5 F5:0.5 | F5:1 E5:1 E5:1 E5:0.5 E5:0.5 | E5:1 D5:1 D5:1 E5:1 | D5:2 G5:2 |' +
        ' E5:1 E5:1 E5:2 | E5:1 E5:1 E5:2 | E5:1 G5:1 C5:1.5 D5:0.5 | E5:4 | F5:1 F5:1 F5:1 F5:1 | F5:1 E5:1 E5:1 E5:0.5 E5:0.5 | G5:1 G5:1 F5:1 D5:1 | C5:4',
      chords: 'C C C F F G G C C C C F F G G C C C C C F C D G C C C C F C G C',
    }),
    xmSong({
      name: 'We Wish You a Merry Christmas',
      bpm: 156,
      bpb: 3,
      pickup: 1,
      mel:
        'D4:1 | G4:1 G4:0.5 A4:0.5 G4:0.5 F#4:0.5 | E4:1 E4:1 E4:1 | A4:1 A4:0.5 B4:0.5 A4:0.5 G4:0.5 | F#4:1 D4:1 D4:1 |' +
        ' B4:1 B4:0.5 C5:0.5 B4:0.5 A4:0.5 | G4:1 E4:1 D4:0.5 D4:0.5 | E4:1 A4:1 F#4:1 | G4:3',
      chords: 'G C A D B C D G',
    }),
    xmSong({
      name: 'Deck the Halls',
      bpm: 138,
      bpb: 4,
      mel:
        'G5:1.5 F5:0.5 E5:1 D5:1 | C5:1 D5:1 E5:1 C5:1 | D5:0.5 E5:0.5 F5:0.5 D5:0.5 E5:1.5 D5:0.5 | C5:1 B4:1 C5:2 |' +
        ' G5:1.5 F5:0.5 E5:1 D5:1 | C5:1 D5:1 E5:1 C5:1 | D5:0.5 E5:0.5 F5:0.5 D5:0.5 E5:1.5 D5:0.5 | C5:1 B4:1 C5:2 |' +
        ' D5:1.5 E5:0.5 F5:1 D5:1 | E5:1.5 F5:0.5 G5:1 D5:1 | E5:0.5 F#5:0.5 G5:1 A5:0.5 B5:0.5 C6:1 | B5:1 A5:1 G5:2 |' +
        ' G5:1.5 F5:0.5 E5:1 D5:1 | C5:1 D5:1 E5:1 C5:1 | A5:0.5 A5:0.5 A5:0.5 A5:0.5 G5:1.5 F5:0.5 | E5:1 D5:1 C5:2',
      chords: 'C C G C C C G C G C D G C C F C',
    }),
    xmSong({
      name: 'Silent Night',
      bpm: 92,
      bpb: 3,
      wave: 'triangle',
      shift: 12,
      mel:
        'G4:1.5 A4:0.5 G4:1 | E4:3 | G4:1.5 A4:0.5 G4:1 | E4:3 | D5:2 D5:1 | B4:3 | C5:2 C5:1 | G4:3 |' +
        ' A4:2 A4:1 | C5:1.5 B4:0.5 A4:1 | G4:1.5 A4:0.5 G4:1 | E4:3 | A4:2 A4:1 | C5:1.5 B4:0.5 A4:1 | G4:1.5 A4:0.5 G4:1 | E4:3 |' +
        ' D5:2 D5:1 | F5:1.5 D5:0.5 B4:1 | C5:3 | E5:3 | C5:1 G4:1 E4:1 | G4:1.5 F4:0.5 D4:1 | C4:3 | -:3',
      chords: 'C C C C G G C C F F C C F F C C G G C C C G C C',
    }),
    xmSong({
      name: 'Joy to the World',
      bpm: 120,
      bpb: 4,
      shift: 12,
      mel:
        'C5:2 B4:1.5 A4:0.5 | G4:3 F4:1 | E4:2 D4:2 | C4:3 G4:1 | A4:3 A4:1 | B4:3 B4:1 | C5:3 C5:1 |' +
        ' B4:1 A4:1 G4:1.5 F4:0.5 | E4:1 C5:1 C5:1 B4:1 | A4:1 G4:1.5 F4:0.5 E4:1 | E4:1 E4:1 E4:1 E4:0.5 F4:0.5 | G4:3 F4:0.5 E4:0.5 |' +
        ' D4:1 D4:1 D4:1 D4:0.5 E4:0.5 | F4:3 E4:0.5 D4:0.5 | C4:1 C5:2 A4:1 | G4:1.5 F4:0.5 E4:1 F4:1 | E4:2 D4:2 | C4:4',
      chords: 'C G C C F G C G C F C C G G C C G C',
    }),
  ];

  const XM = { ctx: null, bus: null, on: false, si: 0, i: 0, t0: 0, realign: true, noise: null, vol: 0.09, sfxVol: 0.55, buf: null, lastSample: {}, sfxUntil: 0 };
  window.__pxtXmas = XM; // gỡ lỗi: __pxtXmas.vol = 0.15 (âm lượng), cfg nhạc lưu ở pixel-themes:v1 -> music

  function xmBus() {
    const c = XM.ctx;
    const master = c.createGain();
    master.gain.setValueAtTime(0, c.currentTime);
    master.gain.linearRampToValueAtTime(XM.vol, c.currentTime + 0.6);
    master.connect(c.destination);
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 3800;
    lp.connect(master);
    const echo = c.createDelay(1);
    echo.delayTime.value = 0.21;
    const fb = c.createGain();
    fb.gain.value = 0.26;
    echo.connect(fb);
    fb.connect(echo);
    echo.connect(lp);
    const lead = c.createGain();
    lead.connect(lp);
    lead.connect(echo);
    const hp = c.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 6500;
    hp.connect(master);
    // Tiếng thật (hô hô hô, chuông) đi đường riêng, to hơn nhạc nền; tắt nhạc là tắt luôn.
    const sfx = c.createGain();
    sfx.gain.value = XM.sfxVol;
    sfx.connect(c.destination);
    return { master, lp, lead, hp, sfx };
  }

  /* Âm thanh thật CC0 từ BigSoundBank (Joseph Sardin): "Santa Claus, Oh Oh Oh" #1-#5 và
     "Bells of Santa Claus #1", đã cắt gọn ở sounds/*.ogg. Launcher nhúng vào biến PXT_SOUNDS
     (base64); không có thì dùng âm tự tổng hợp bên dưới. */
  function xmLoadSamples() {
    if (XM.buf || typeof PXT_SOUNDS === 'undefined') return;
    XM.buf = { ho: [], chuong: [] };
    for (const [name, b64] of Object.entries(PXT_SOUNDS)) {
      const kind = name.replace(/\d+$/, '');
      if (!XM.buf[kind]) continue;
      try {
        const bin = atob(b64);
        const u8 = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
        XM.ctx.decodeAudioData(u8.buffer).then(
          (ab) => XM.buf[kind].push(ab),
          (e) => console.warn('[Pixel Themes] khong giai ma duoc am thanh', name, e),
        );
      } catch (e) {
        console.warn('[Pixel Themes] am thanh hong:', name, e);
      }
    }
  }

  // Phát 1 bản ngẫu nhiên (không lặp lại bản vừa phát). Trả về độ dài (giây) hoặc 0 nếu chưa có.
  function xmSample(kind, at) {
    const list = XM.buf && XM.buf[kind];
    if (!list || !list.length) return 0;
    let k = (Math.random() * list.length) | 0;
    if (list.length > 1 && k === XM.lastSample[kind]) k = (k + 1) % list.length;
    XM.lastSample[kind] = k;
    const src = XM.ctx.createBufferSource();
    src.buffer = list[k];
    src.playbackRate.value = rnd(0.97, 1.03);
    src.connect(XM.bus.sfx);
    src.start(at);
    return list[k].duration;
  }

  // Nhạc nền nhỏ lại trong lúc có tiếng thật, rồi to lên lại.
  function xmDuck(at, dur) {
    const g = XM.bus.master.gain;
    g.cancelScheduledValues(at);
    g.setValueAtTime(XM.vol, at);
    g.linearRampToValueAtTime(XM.vol * 0.35, at + 0.12);
    g.setValueAtTime(XM.vol * 0.35, at + dur);
    g.linearRampToValueAtTime(XM.vol, at + dur + 0.5);
  }

  function xmVoice(type, f, at, dur, peak, out) {
    const c = XM.ctx;
    const o = c.createOscillator();
    o.type = type;
    o.frequency.value = f;
    const g = c.createGain();
    const end = at + dur;
    g.gain.setValueAtTime(0.0001, at);
    g.gain.linearRampToValueAtTime(peak, at + 0.012);
    g.gain.exponentialRampToValueAtTime(peak * 0.5, at + Math.min(0.15, dur * 0.6));
    g.gain.linearRampToValueAtTime(0.0001, end);
    o.connect(g);
    g.connect(out);
    o.start(at);
    o.stop(end + 0.02);
  }

  function xmPlay(e, at, spb) {
    const B = XM.bus;
    if (e.k === 0) {
      const dur = e.d * spb * 0.9;
      xmVoice(e.w || 'square', e.f, at, dur, e.w === 'triangle' ? 0.34 : 0.2, B.lead);
      xmVoice('sine', e.f * 2, at, Math.min(dur, 0.35), 0.08, B.lead); // tiếng chuông leng keng phía trên
    } else if (e.k === 1) {
      xmVoice('triangle', e.f, at, e.d * spb, 0.42, B.lp);
    } else {
      const c = XM.ctx;
      const src = c.createBufferSource();
      src.buffer = XM.noise;
      src.playbackRate.value = rnd(0.9, 1.1);
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, at);
      g.gain.linearRampToValueAtTime(0.32 * e.v, at + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, at + 0.09);
      src.connect(g);
      g.connect(B.hp);
      src.start(at, rnd(0, 0.5));
      src.stop(at + 0.12);
    }
  }

  function xmStart() {
    try {
      if (!XM.ctx) {
        XM.ctx = new (window.AudioContext || window.webkitAudioContext)();
        const len = XM.ctx.sampleRate;
        XM.noise = XM.ctx.createBuffer(1, len, len);
        const d = XM.noise.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        xmLoadSamples();
        // App chặn tự phát tiếng khi chưa có thao tác: phát tiếp ở lần bấm/gõ phím đầu tiên.
        const wake = () => XM.on && XM.ctx.state !== 'running' && XM.ctx.resume().catch(() => {});
        addEventListener('pointerdown', wake, true);
        addEventListener('keydown', wake, true);
      }
      if (XM.ctx.state !== 'running') XM.ctx.resume().catch(() => {});
      XM.vol = 0.09 * (cfg.xmVol == null ? 1 : cfg.xmVol);
      XM.sfxVol = 0.55 * Math.min(1.5, cfg.xmVol == null ? 1 : cfg.xmVol);
      XM.bus = xmBus();
      XM.on = true;
      XM.realign = true;
    } catch (e) {
      console.warn('[Pixel Themes] khong phat duoc nhac Giang Sinh:', e);
      XM.on = false;
    }
  }

  function xmStop() {
    XM.on = false;
    const B = XM.bus;
    XM.bus = null;
    if (!B || !XM.ctx) return;
    const c = XM.ctx;
    B.master.gain.cancelScheduledValues(c.currentTime);
    B.master.gain.setValueAtTime(B.master.gain.value, c.currentTime);
    B.master.gain.linearRampToValueAtTime(0, c.currentTime + 0.35);
    setTimeout(() => {
      B.master.disconnect();
      if (!XM.on && XM.ctx.state === 'running') XM.ctx.suspend().catch(() => {});
    }, 450);
  }

  function xmPump() {
    const c = XM.ctx;
    if (!c || !XM.bus || c.state !== 'running') return;
    const now = c.currentTime;
    let S = XM_SONGS[XM.si];
    if (XM.realign) {
      XM.realign = false;
      const e = S.ev[XM.i];
      XM.t0 = now + 0.15 - (e ? e.t : 0) * S.spb;
    }
    for (let guard = 0; guard < 400; guard++) {
      if (XM.i >= S.ev.length) {
        XM.t0 += S.len * S.spb + 1.2;
        XM.si = xmPickNext();
        XM.i = 0;
        S = XM_SONGS[XM.si];
        continue;
      }
      const e = S.ev[XM.i];
      const at = XM.t0 + e.t * S.spb;
      if (at > now + 0.35) break;
      if (at >= now - 0.05) xmPlay(e, at, S.spb);
      XM.i++;
    }
  }

  // Bong bóng thoại: nền trắng viền đỏ, đuôi chỉ xuống (cx, cy) tính bằng px.
  function xmBubble(w, cx, cy, text, a, border = '#b3202b', color = '#c4161c') {
    const ctx = w.ctx;
    const fs = Math.max(11, Math.round(w.cell * 1.05));
    ctx.font = `700 ${fs}px ${FONT}`;
    const pw = ctx.measureText(text).width + fs * 1.2;
    const ph = fs * 1.9;
    const x = clamp(cx - pw / 2, 4, Math.max(4, w.w - pw - 4));
    const y = Math.max(2, cy - ph - fs * 0.6);
    ctx.globalAlpha = clamp(a, 0, 1);
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = border;
    ctx.lineWidth = 2;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, pw, ph, fs * 0.5);
    else ctx.rect(x, y, pw, ph);
    ctx.fill();
    ctx.stroke();
    const tx = clamp(cx, x + fs, x + pw - fs);
    ctx.beginPath();
    ctx.moveTo(tx - fs * 0.4, y + ph - 1);
    ctx.lineTo(tx, Math.max(y + ph + 2, cy));
    ctx.lineTo(tx + fs * 0.4, y + ph - 1);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x + pw / 2, y + ph / 2 + 1);
    ctx.globalAlpha = 1;
  }

  /* Tiếng ông già Noel và chuông. Chỉ kêu khi nhạc Giáng Sinh đang bật (cùng ô "Nhạc Giáng Sinh").
     "Hô": sóng răng cưa giọng trầm, trượt xuống, lọc qua 3 formant của nguyên âm "o", có hơi "h" ở đầu.
     Chuông: các họa âm lệch (1 : 2 : 2.76 : 5.4 : 8.93) tắt dần như chuông cầm tay. */
  function xmHo(at, f0) {
    const c = XM.ctx;
    const out = c.createGain();
    out.gain.value = 3;
    out.connect(XM.bus.master);
    const o = c.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(f0 * 1.15, at);
    o.frequency.exponentialRampToValueAtTime(f0 * 0.82, at + 0.34);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.linearRampToValueAtTime(0.9, at + 0.05);
    g.gain.setValueAtTime(0.9, at + 0.2);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.38);
    o.connect(g);
    for (const [f, q, v] of [[470, 6, 1], [820, 8, 0.6], [2600, 10, 0.12]]) {
      const bp = c.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = f;
      bp.Q.value = q;
      const bg = c.createGain();
      bg.gain.value = v;
      g.connect(bp);
      bp.connect(bg);
      bg.connect(out);
    }
    const hs = c.createBufferSource();
    hs.buffer = XM.noise;
    const hb = c.createBiquadFilter();
    hb.type = 'bandpass';
    hb.frequency.value = 1200;
    hb.Q.value = 1;
    const hg = c.createGain();
    hg.gain.setValueAtTime(0.0001, at - 0.07);
    hg.gain.linearRampToValueAtTime(0.12, at - 0.02);
    hg.gain.exponentialRampToValueAtTime(0.0001, at + 0.06);
    hs.connect(hb);
    hb.connect(hg);
    hg.connect(out);
    hs.start(at - 0.07, rnd(0, 0.5));
    hs.stop(at + 0.08);
    o.start(at);
    o.stop(at + 0.4);
  }

  function xmBell(at, f, v) {
    const c = XM.ctx;
    for (const [r, amp, dec] of [[1, 1, 1.6], [2, 0.5, 1], [2.76, 0.35, 0.7], [5.4, 0.2, 0.4], [8.93, 0.1, 0.25]]) {
      if (f * r > 16000) continue;
      const o = c.createOscillator();
      o.type = 'sine';
      o.frequency.value = f * r;
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, at);
      g.gain.linearRampToValueAtTime(v * amp, at + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, at + dec * 1.6);
      o.connect(g);
      g.connect(XM.bus.master);
      o.start(at);
      o.stop(at + dec * 1.6 + 0.05);
    }
  }

  function xmSfx(kind) {
    const c = XM.ctx;
    if (!XM.on || !XM.bus || !c || c.state !== 'running') return false;
    const at = c.currentTime + 0.06;
    const real = xmSample(kind === 'ho' ? 'ho' : 'chuong', at);
    if (real) {
      xmDuck(at, real);
      XM.sfxUntil = at + real + 0.4;
      return true;
    }
    XM.sfxUntil = at + (kind === 'ho' ? 1.4 : 1.6) + 0.4;
    if (kind === 'ho') {
      xmHo(at, 108);
      xmHo(at + 0.42, 101);
      xmHo(at + 0.84, 92);
    } else {
      // "Ring ring": 2 lần lắc chuông, mỗi lần 4 tiếng gõ nhanh xen 2 cao độ + tiếng lục lạc.
      for (const t0 of [0, 0.5]) {
        for (let k = 0; k < 4; k++) xmBell(at + t0 + k * 0.06, k % 2 ? 1975.5 : 1568, k ? 0.16 : 0.3);
        for (let k = 0; k < 6; k++) xmPlay({ k: 2, v: 0.7 }, at + t0 + k * 0.045, 0);
      }
    }
    return true;
  }
  // Đang có tiếng thật phát thì chờ, không cho tiếng hô và chuông chồng lên nhau.
  function xmSfxBusy() {
    return !!XM.ctx && XM.ctx.currentTime < XM.sfxUntil;
  }
  XM.sfx = xmSfx; // gỡ lỗi: __pxtXmas.sfx('ho') / __pxtXmas.sfx('ring')

  setInterval(() => {
    let want = false;
    try {
      want = curId === 'xmas' && cfg.music !== false && !document.hidden;
    } catch (e) {
      /* script chưa chạy xong */
    }
    if (want && !XM.on) xmStart();
    else if (!want && XM.on) xmStop();
    if (XM.on) xmPump();
  }, 120);

  // Ô "Nhạc Giáng Sinh" trong bảng Alt+T.
  const _buildPanel = buildPanel;
  buildPanel = function () {
    _buildPanel();
    try {
      const ctl = panel.querySelector('.ctl');
      if (ctl)
        ctl.append(
          h('label', null, h('input', { type: 'checkbox', checked: cfg.botFree !== false, onchange: (e) => { cfg.botFree = e.target.checked; FB.x = null; save(); } }), 'Bot đi tự do'),
          h('label', null, h('input', { type: 'checkbox', checked: cfg.music !== false, onchange: (e) => { cfg.music = e.target.checked; save(); } }), 'Nhạc & tiếng Giáng Sinh'),
        );
    } catch (e) {
      /* bảng chọn đổi cấu trúc: bỏ qua ô này */
    }
  };


  /* --------------------------------------------- custom: bot Claude nói chuyện */
  // Lâu lâu bot nói 1 câu trong bong bóng thoại trên đầu (trên cả nón Noel). Câu tuỳ tình huống:
  // Claude bắt đầu/làm xong task, đang chạy task, chuột chọc vào bot, khuya, theme Giáng Sinh.
  // Tắt bằng ô "Bot nói chuyện" trong Alt+T. Gỡ lỗi: __pxtBotTalk.say('câu gì đó').
  const BOT_LINES = {
    idle: [
      'Hôm nay code gì đây?', 'Nhớ uống nước nha!', 'Commit chưa đó?', 'Ctrl+S chưa bạn?',
      'Tui đi dạo chút...', 'Bấm Alt+T đổi theme nè', 'Nghỉ mắt 20 giây đi!', 'Bug nào tui cũng cân!',
      'Gõ gì đi, tui chờ nè', 'Hôm nay trời đẹp ghê', 'Đừng quên backup nha', 'Tui là bot Claude nè!',
    ],
    busy: ['Đang làm, chờ xíu...', 'Code đang rơi kìa!', 'Tui đang nghĩ...', 'Sắp xong rồi!', 'Chạy nè chạy nè!'],
    start: ['Bắt tay vào việc thôi!', 'Để tui lo!', 'Bắt đầu nha!'],
    done: ['Xong rồi nè!', 'Xong! Xem thử đi', 'Hoàn thành!'],
    poke: ['Nhột quá!', 'Hihi', 'Ê, đừng chọc!', 'Ủa gì đó?', 'Bắt được tui hông?'],
    night: ['Khuya rồi, ngủ đi bạn!', 'Mắt đỏ rồi kìa...', 'Mai làm tiếp nha'],
    xmas: ['Giáng Sinh vui vẻ!', 'Nón đẹp hông?', 'Ông già Noel kìa!', 'Lạnh quá trời...', 'Có quà cho tui hông?'],
  };
  const BOT_TALK = { t: rnd(6, 12), text: '', sayT: 0, cool: 0, busy: false, reply: 0, last: '' };
  window.__pxtBotTalk = { state: BOT_TALK, say: (txt, d = 3.5) => botSay(txt, d) };
  function botSay(text, dur = 3.2) {
    BOT_TALK.text = text;
    BOT_TALK.sayT = dur;
    BOT_TALK.last = text;
  }
  function botPick(kind) {
    const list = BOT_LINES[kind];
    let line = pick(list);
    if (line === BOT_TALK.last && list.length > 1) line = pick(list);
    return line;
  }

  const _botFrameTalk = botFrame;
  botFrame = function (w, dt) {
    // Ghi lại vùng bot vừa vẽ (các ô màu thân bot) để đặt bong bóng thoại ngay trên đầu.
    const bodyBg = new Set([BOT_PAL.H[0], BOT_PAL.B[0], BOT_PAL.A[0]]);
    let x0 = Infinity;
    let x1 = -Infinity;
    let y0 = null;
    let bs = 0;
    const orig = w.tileAt;
    w.tileAt = function (px, py, size, bg, ...rest) {
      if (bodyBg.has(bg)) {
        x0 = Math.min(x0, px);
        x1 = Math.max(x1, px);
        if (y0 == null || py < y0) y0 = py;
        bs = size;
      }
      return orig.call(this, px, py, size, bg, ...rest);
    };
    try {
      _botFrameTalk(w, dt);
    } finally {
      delete w.tileAt;
    }
    if (y0 == null || cfg.botTalk === false) return;
    const T = BOT_TALK;
    T.t -= dt;
    T.cool -= dt;
    // Sự kiện: Claude bắt đầu / làm xong task (cùng tín hiệu với mưa code).
    const busy = !!RAIN.on;
    if (busy !== T.busy) {
      T.busy = busy;
      if (T.cool <= 0) {
        botSay(botPick(busy ? 'start' : 'done'));
        T.cool = 5;
        T.t = rnd(20, 40);
      }
    }
    // Chuột chọc vào bot.
    const near = mouse.active && mouse.x > x0 - bs && mouse.x < x1 + bs * 2 && mouse.y > y0 - bs && mouse.y < y0 + bs * 6;
    if (near && T.cool <= 0 && T.sayT <= 0 && Math.random() < 0.5) {
      botSay(botPick('poke'), 2);
      T.cool = 8;
    }
    // Hô theo ông già Noel.
    if (T.reply > 0) {
      T.reply -= dt;
      if (T.reply <= 0 && curId === 'xmas' && Math.random() < 0.6) botSay('Hô hô hô!', 2.2);
    }
    // Lâu lâu nói 1 câu.
    if (T.t <= 0) {
      T.t = rnd(25, 55);
      if (T.sayT <= 0) {
        const h = new Date().getHours();
        const r = Math.random();
        let kind = 'idle';
        if (busy && r < 0.7) kind = 'busy';
        else if ((h >= 23 || h < 5) && r < 0.5) kind = 'night';
        else if (curId === 'xmas' && r < 0.55) kind = 'xmas';
        botSay(botPick(kind));
      }
    }
    if (T.sayT > 0) {
      T.sayT -= dt;
      const top = y0 - (curId === 'xmas' ? 4 * bs : 0);
      xmBubble(w, (x0 + x1 + bs) / 2, top - 4, T.text, Math.min(1, T.sayT / 0.35), '#d97757', '#3b2a22');
    }
  };

  // Ô "Bot nói chuyện" trong bảng Alt+T.
  const _buildPanel2 = buildPanel;
  buildPanel = function () {
    _buildPanel2();
    try {
      const ctl = panel.querySelector('.ctl');
      if (ctl) ctl.append(h('label', null, h('input', { type: 'checkbox', checked: cfg.botTalk !== false, onchange: (e) => { cfg.botTalk = e.target.checked; BOT_TALK.sayT = 0; save(); } }), 'Bot nói chuyện'));
    } catch (e) {
      /* bỏ qua */
    }
  };

  /* ------------------------------------------- custom: khung đổi nhạc Giáng Sinh */
  // Hàng "Nhạc:" trong bảng Alt+T: chọn 1 bài (lặp lại bài đó) hoặc phát lần lượt cả 5 bài,
  // nút "Bài sau", thanh âm lượng, và dòng "đang phát".
  function xmPickNext() {
    const sel = cfg.xmSong == null ? -1 : +cfg.xmSong;
    if (sel >= 0 && sel < XM_SONGS.length) return sel;
    return (XM.si + 1) % XM_SONGS.length;
  }
  // Nhảy sang bài idx ngay: bỏ các nốt đã xếp lịch của bài cũ (tắt nhanh bus cũ, tạo bus mới).
  function xmJump(idx) {
    XM.si = clamp(idx, 0, XM_SONGS.length - 1);
    XM.i = 0;
    XM.realign = true;
    if (XM.on && XM.bus && XM.ctx) {
      const old = XM.bus;
      const c = XM.ctx;
      old.master.gain.cancelScheduledValues(c.currentTime);
      old.master.gain.setTargetAtTime(0, c.currentTime, 0.03);
      setTimeout(() => {
        try {
          old.master.disconnect();
          old.sfx.disconnect();
        } catch (e) {
          /* đã ngắt */
        }
      }, 300);
      XM.bus = xmBus();
    }
  }
  function xmSetVol(v) {
    cfg.xmVol = v;
    XM.vol = 0.09 * v;
    XM.sfxVol = 0.55 * Math.min(1.5, v);
    if (XM.bus && XM.ctx) {
      XM.bus.master.gain.setTargetAtTime(XM.vol, XM.ctx.currentTime, 0.05);
      XM.bus.sfx.gain.setTargetAtTime(XM.sfxVol, XM.ctx.currentTime, 0.05);
    }
  }
  XM.jump = xmJump; // gỡ lỗi: __pxtXmas.jump(3)

  const XM_UI_CSS = `
.pxt-song { font: inherit; font-size: 11px; color: inherit; background: rgba(127,127,127,.16); border: 1px solid rgba(127,127,127,.35); border-radius: 6px; padding: 2px 4px; max-width: 220px; }
.pxt-song option { color: #1b1714; background: #fff; }
.pxt-next { font: inherit; font-size: 11px; color: inherit; background: rgba(127,127,127,.16); border: 1px solid rgba(127,127,127,.35); border-radius: 6px; padding: 2px 8px; cursor: pointer; }
.pxt-next:hover { background: rgba(127,127,127,.3); }
.pxt-now { font-size: 11px; opacity: .7; margin-left: auto; }
`;
  const _buildPanel3 = buildPanel;
  buildPanel = function () {
    _buildPanel3();
    try {
      sheet(XM_UI_CSS, panel.getRootNode());
      const cur = () => (cfg.xmSong == null ? -1 : +cfg.xmSong);
      const sel = h(
        'select',
        { class: 'pxt-song', 'aria-label': 'Chọn nhạc Giáng Sinh', onchange: (e) => { cfg.xmSong = +e.target.value; save(); if (cfg.xmSong >= 0) xmJump(cfg.xmSong); } },
        h('option', { value: '-1' }, `Phát lần lượt cả ${XM_SONGS.length} bài`),
        XM_SONGS.map((S, i) => h('option', { value: String(i) }, `${i + 1}. ${S.name}`)),
      );
      sel.value = String(cur());
      const now = h('span', { class: 'pxt-now' }, '');
      const next = () => {
        const n = (XM.si + 1) % XM_SONGS.length;
        if (cur() >= 0) {
          cfg.xmSong = n;
          sel.value = String(n);
          save();
        }
        xmJump(n);
      };
      const row = h(
        'div',
        { class: 'ctl' },
        h('label', null, 'Nhạc:', sel),
        h('button', { type: 'button', class: 'pxt-next', onclick: next }, 'Bài sau ⏭'),
        h('label', null, 'Âm lượng', h('input', { type: 'range', min: '0', max: '2', step: '0.05', value: String(cfg.xmVol == null ? 1 : cfg.xmVol), oninput: (e) => { xmSetVol(+e.target.value); save(); } })),
        now,
      );
      panel.append(row);
      const tick = () => {
        if (!row.isConnected) return;
        now.textContent = XM.on ? '♪ Đang phát: ' + XM_SONGS[XM.si].name : curId === 'xmas' ? '(nhạc đang tắt)' : '(nhạc chỉ phát ở theme Giáng Sinh)';
        setTimeout(tick, 500);
      };
      tick();
    } catch (e) {
      console.warn('[Pixel Themes] khong them duoc khung doi nhac:', e);
    }
  };

  // Ô "Nền tối sau chữ" + độ đậm trong bảng Alt+T.
  const _buildPanel4 = buildPanel;
  buildPanel = function () {
    _buildPanel4();
    try {
      const ctl = panel.querySelector('.ctl');
      if (ctl)
        ctl.append(
          h('label', null, h('input', { type: 'checkbox', checked: cfg.textBgOn !== false, onchange: (e) => { cfg.textBgOn = e.target.checked; save(); if (!raf) paint(0); } }), 'Nền tối sau chữ'),
          h('label', null, 'Độ đậm nền chữ', h('input', { type: 'range', min: '0', max: '0.85', step: '0.05', value: String(cfg.textBg == null ? 0.5 : cfg.textBg), oninput: (e) => { cfg.textBg = +e.target.value; save(); if (!raf) paint(0); } })),
        );
    } catch (e) {
      /* bỏ qua */
    }
  };

  /* ------------------------------------- custom: tuyết đọng trên ô chat + bot quét */
  // Theme Giáng Sinh: bông tuyết rơi trúng mép trên ô nhập chat thì đọng lại thành đống (có cả
  // tuyết lất phất cho đống dày lên trong ~1 phút). Dày quá thì bot vác chổi ra quét (xem FB.mode
  // 'sweep' ở trên), tuyết văng tung toé. Bot tắt hoặc không đi tự do thì đống tuyết tự tan bớt.
  const PILE = { on: false, left: 0, width: 0, top: 0, slot: 4, h: null, max: 40, need: false, puffs: [] };
  window.__pxtPile = PILE; // gỡ lỗi: __pxtPile.h.fill(30) -> đầy tuyết ngay
  function xmPileH(px) {
    const H = PILE.h;
    if (!H) return 0;
    const i = Math.floor(((px - PILE.left) / PILE.width) * H.length);
    return i >= 0 && i < H.length ? H[i] : 0;
  }
  function xmPileAdd(px, amt) {
    const H = PILE.h;
    if (!H) return;
    const c = Math.floor(((px - PILE.left) / PILE.width) * H.length);
    const wts = [0.25, 0.6, 1, 0.6, 0.25];
    for (let k = -2; k <= 2; k++) {
      const i = c + k;
      if (i >= 0 && i < H.length) H[i] = Math.min(PILE.max, H[i] + amt * wts[k + 2]);
    }
  }
  function xmPileUpdate(w, dt) {
    const b = layout.box;
    PILE.on = curId === 'xmas' && !!b && cfg.snowPile !== false;
    if (!PILE.on) {
      if (PILE.h) PILE.h.fill(0);
      PILE.need = false;
      return;
    }
    const n = Math.max(8, Math.round(b.width / PILE.slot));
    if (!PILE.h || PILE.h.length !== n) {
      const old = PILE.h;
      PILE.h = new Float32Array(n);
      if (old) for (let i = 0; i < n; i++) PILE.h[i] = old[Math.floor((i * old.length) / n)];
    }
    PILE.left = b.left;
    PILE.width = b.width;
    PILE.top = b.top;
    PILE.max = clamp(w.cell * 3, 30, 48);
    const H = PILE.h;
    // Tuyết lất phất: trung bình dày thêm ~ max*0.55 sau 70 giây.
    const total = ((PILE.max * 0.55) / 70) * n * dt;
    for (let k = 0; k < 3; k++) xmPileAdd(PILE.left + Math.random() * PILE.width, total / 3 / 2.7);
    // Tuyết dồn từ chỗ cao xuống chỗ thấp cho mặt đống tự nhiên.
    for (let i = 0; i < n - 1; i++) {
      const d = H[i] - H[i + 1];
      if (Math.abs(d) > 2.5) {
        const m = (Math.abs(d) - 2.5) * 0.25 * Math.sign(d);
        H[i] -= m;
        H[i + 1] += m;
      }
    }
    let sum = 0;
    for (let i = 0; i < n; i++) sum += H[i];
    const mean = sum / n;
    const canSweep = cfg.bot !== false && cfg.botFree !== false;
    if (canSweep && mean > PILE.max * 0.5) PILE.need = true;
    if (!canSweep && mean > PILE.max * 0.6) for (let i = 0; i < n; i++) H[i] *= 1 - 0.25 * dt;
  }
  function xmPileSweep(x0, x1, dt) {
    const H = PILE.h;
    if (!H) return;
    const sl = PILE.width / H.length;
    for (let i = 0; i < H.length; i++) {
      const x = PILE.left + (i + 0.5) * sl;
      if (x < x0 || x > x1 || H[i] <= 0) continue;
      const rm = Math.min(H[i], 260 * dt);
      H[i] -= rm;
      if (PILE.puffs.length < 260 && Math.random() < rm * 0.3)
        PILE.puffs.push({ x, y: PILE.top - H[i] - 2, vx: rnd(30, 160), vy: rnd(-180, -60), a: 1, r: rnd(2, 4.5) });
    }
  }
  function xmPileDraw(w) {
    const H = PILE.h;
    if (!PILE.on || !H) return;
    let any = false;
    for (let i = 0; i < H.length; i++) if (H[i] > 0.8) { any = true; break; }
    if (!any) return;
    const ctx = w.ctx;
    const n = H.length;
    const sl = PILE.width / n;
    const top = PILE.top + 1;
    ctx.beginPath();
    ctx.moveTo(PILE.left, top);
    for (let i = 0; i < n; i++) {
      const edge = Math.min(1, Math.min(i, n - 1 - i) / 5); // hai đầu vát xuống
      ctx.lineTo(PILE.left + (i + 0.5) * sl, top - Math.round((H[i] * edge) / 2) * 2);
    }
    ctx.lineTo(PILE.left + PILE.width, top);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, top - PILE.max, 0, top);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(1, '#cddff6');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = 'rgba(150, 185, 230, 0.9)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // Lấp lánh trên mặt tuyết.
    ctx.fillStyle = '#ffffff';
    for (let i = 3; i < n - 3; i += 7) {
      if (H[i] < 5 || Math.sin(w.t * 2.5 + i * 1.7) < 0.9) continue;
      const x = PILE.left + (i + 0.5) * sl;
      const y = top - H[i] + 3;
      ctx.fillRect(x - 3, y, 7, 1.5);
      ctx.fillRect(x, y - 3, 1.5, 7);
    }
  }
  function xmPuffs(w, dt) {
    const P = PILE.puffs;
    if (!P.length) return;
    const ctx = w.ctx;
    ctx.fillStyle = '#ffffff';
    for (let i = P.length - 1; i >= 0; i--) {
      const q = P[i];
      q.vy += 420 * dt;
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      q.a -= dt * 1.1;
      if (q.a <= 0) {
        P.splice(i, 1);
        continue;
      }
      ctx.globalAlpha = Math.min(1, q.a);
      ctx.fillRect(q.x - q.r / 2, q.y - q.r / 2, q.r, q.r);
    }
    ctx.globalAlpha = 1;
  }

  const _botFramePile = botFrame;
  botFrame = function (w, dt) {
    xmPileDraw(w); // đống tuyết vẽ trước, bot đứng lên/lội trong tuyết
    _botFramePile(w, dt);
    xmPuffs(w, dt); // tuyết văng vẽ sau cùng
  };

  // Ô "Tuyết đọng trên ô chat" trong bảng Alt+T.
  const _buildPanel5 = buildPanel;
  buildPanel = function () {
    _buildPanel5();
    try {
      const ctl = panel.querySelector('.ctl');
      if (ctl) ctl.append(h('label', null, h('input', { type: 'checkbox', checked: cfg.snowPile !== false, onchange: (e) => { cfg.snowPile = e.target.checked; save(); } }), 'Tuyết đọng trên ô chat'));
    } catch (e) {
      /* bỏ qua */
    }
  };
