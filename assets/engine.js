// =====================================================================
//  像素渲染引擎（零依赖）
//  - 画面层 ART：横屏 480×270 / 竖屏 270×480 低分辨率像素画（最终放大 4 倍）
//  - 界面层 UI ：横屏 960×540 / 竖屏 540×960（放大 2 倍），用于字幕、对话框、数值面板
//  - 画幅和字体由 config.js 的 window.MV_CONFIG 决定
//  所有绘制都只依赖时间 t，所以同一个 t 永远得到同一帧（方便逐帧导出）
// =====================================================================
(function (G) {
  const CFG = Object.assign({ format: 'landscape', script: 'sc' }, G.MV_CONFIG || {});
  const PORTRAIT = CFG.format === 'portrait';
  const AW = PORTRAIT ? 270 : 480, AH = PORTRAIT ? 480 : 270, UW = AW * 2, UH = AH * 2;

  // ---------- 颜色 & 数学工具 ----------
  const C = (hex, a = 255) => {
    const n = parseInt(hex.slice(1), 16);
    return (((a & 255) << 24) | ((n & 255) << 16) | (((n >> 8) & 255) << 8) | ((n >> 16) & 255)) >>> 0;
  };
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + 0.5) / 16);
  const bayer = (x, y) => BAYER[((y & 3) << 2) | (x & 3)];
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, k) => a + (b - a) * k;
  const inv = (a, b, v) => clamp((v - a) / (b - a));
  const ease = {
    out: k => 1 - Math.pow(1 - clamp(k), 3),
    in: k => Math.pow(clamp(k), 3),
    inOut: k => { k = clamp(k); return k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; },
    back: k => { k = clamp(k); const c = 1.70158; return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); },
  };
  // 确定性随机数（同一个 n 永远返回同一个值）
  const hash = n => { let x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

  // ---------- 像素画布 ----------
  class Raster {
    constructor(w, h) {
      this.w = w; this.h = h;
      this.img = new ImageData(w, h);
      this.buf = new Uint32Array(this.img.data.buffer);
      this.ox = 0; this.oy = 0;
    }
    clear(c = 0) { this.buf.fill(c); }
    px(x, y, c) {
      x = Math.round(x + this.ox); y = Math.round(y + this.oy);
      if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
      this.buf[y * this.w + x] = c;
    }
    rect(x, y, w, h, c) {
      x = Math.round(x + this.ox); y = Math.round(y + this.oy); w = Math.round(w); h = Math.round(h);
      const x0 = Math.max(0, x), y0 = Math.max(0, y), x1 = Math.min(this.w, x + w), y1 = Math.min(this.h, y + h);
      if (x1 <= x0) return;
      for (let j = y0; j < y1; j++) this.buf.fill(c, j * this.w + x0, j * this.w + x1);
    }
    // 抖动半透明矩形（像素风的"透明度"）
    drect(x, y, w, h, c, a) {
      if (a <= 0) return; if (a >= 1) return this.rect(x, y, w, h, c);
      x = Math.round(x); y = Math.round(y);
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
        const X = x + i + this.ox, Y = y + j + this.oy;
        if (bayer(X, Y) < a) this.px(x + i, y + j, c);
      }
    }
    frame(x, y, w, h, c, t = 1) {
      this.rect(x, y, w, t, c); this.rect(x, y + h - t, w, t, c);
      this.rect(x, y, t, h, c); this.rect(x + w - t, y, t, h, c);
    }
    // 竖向抖动渐变
    vgrad(x, y, w, h, c1, c2, steps = 0) {
      for (let j = 0; j < h; j++) {
        let f = h <= 1 ? 0 : j / (h - 1);
        if (steps) f = Math.round(f * steps) / steps;
        for (let i = 0; i < w; i++) {
          const X = Math.round(x + i + this.ox), Y = Math.round(y + j + this.oy);
          this.px(x + i, y + j, bayer(X, Y) < f ? c2 : c1);
        }
      }
    }
    line(x0, y0, x1, y1, c) {
      x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
      const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
      let err = dx + dy;
      for (let guard = 0; guard < 4000; guard++) {
        this.px(x0, y0, c);
        if (x0 === x1 && y0 === y1) break;
        const e2 = 2 * err;
        if (e2 >= dy) { err += dy; x0 += sx; }
        if (e2 <= dx) { err += dx; y0 += sy; }
      }
    }
    circ(cx, cy, r, c) {
      for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++)
        if (x * x + y * y <= r * r + r * 0.6) this.px(cx + x, cy + y, c);
    }
    ellipse(cx, cy, rx, ry, c) {
      for (let y = -ry; y <= ry; y++) for (let x = -rx; x <= rx; x++)
        if ((x * x) / (rx * rx) + (y * y) / (ry * ry) <= 1.02) this.px(cx + x, cy + y, c);
    }
    // 网点光晕（参考视频里那种圆形点阵光）
    halo(cx, cy, r, c, strength = 1, step = 2) {
      const R = Math.ceil(r);
      for (let y = -R; y <= R; y += 1) for (let x = -R; x <= R; x += 1) {
        const X = Math.round(cx + x), Y = Math.round(cy + y);
        if (((X % step) + step) % step || ((Y % step) + step) % step) continue;
        const d = Math.sqrt(x * x + y * y) / r;
        if (d >= 1) continue;
        const v = strength * Math.pow(1 - d, 1.4);
        if (bayer(X / step | 0, Y / step | 0) < v) this.px(X, Y, c);
      }
    }
    // 位图遮罩（文字）
    mask(m, x, y, c, a = 1) {
      x = Math.round(x); y = Math.round(y);
      for (let j = 0; j < m.h; j++) for (let i = 0; i < m.w; i++) {
        if (!m.m[j * m.w + i]) continue;
        if (a < 1 && bayer(x + i, y + j) >= a) continue;
        this.px(x + i, y + j, c);
      }
    }
    // 把另一块画布（透明 = 0）按整数倍放大贴上来，用来画更"大颗粒"的人物
    blitScaled(src, s, dx, dy) {
      const sb = src.buf, w = src.w;
      for (let j = 0; j < src.h; j++) for (let i = 0; i < w; i++) {
        const c = sb[j * w + i]; if (c) this.rect(dx + i * s, dy + j * s, s, s, c);
      }
    }
    // 字符画精灵：rows 是字符串数组，pal 把字符映射到颜色
    sprite(rows, pal, x, y, flip = false, scale = 1) {
      const w = rows[0].length;
      for (let j = 0; j < rows.length; j++) for (let i = 0; i < w; i++) {
        const ch = rows[j][flip ? w - 1 - i : i]; const c = pal[ch];
        if (c === undefined) continue;
        if (scale === 1) this.px(x + i, y + j, c); else this.rect(x + i * scale, y + j * scale, scale, scale, c);
      }
    }
  }

  // ---------- 文字：用系统中文字体渲染后做二值化，得到像素字 ----------
  const FONTS = {
    sc: '"Noto Sans CJK SC","Noto Sans SC","Source Han Sans SC","PingFang SC","Microsoft YaHei","Heiti SC"',
    tc: '"Noto Sans CJK TC","Noto Sans CJK HK","Noto Sans TC","Source Han Sans TC","PingFang TC","PingFang HK","Microsoft JhengHei","Heiti TC"',
    ja: '"Noto Sans CJK JP","Noto Sans JP","Source Han Sans JP","Hiragino Sans","Yu Gothic","Meiryo"',
    ko: '"Noto Sans CJK KR","Noto Sans KR","Source Han Sans KR","Apple SD Gothic Neo","Malgun Gothic"',
    latin: '"Noto Sans","DejaVu Sans","Helvetica Neue",Arial',
  };
  // 选定语言的字体排最前，其余作后备（混排时缺字可以回退）
  const FONT = [FONTS[CFG.script] || FONTS.sc, ...Object.keys(FONTS).filter(k => k !== CFG.script).map(k => FONTS[k]), 'sans-serif'].join(',');
  const tc = document.createElement('canvas');
  const tx = tc.getContext('2d', { willReadFrequently: true });
  const cache = new Map();
  function textMask(str, size, weight = 900, thr = 0.5, spacing = 0) {
    const key = str + '|' + size + '|' + weight + '|' + thr + '|' + spacing;
    let m = cache.get(key); if (m) return m;
    const font = `${weight} ${size}px ${FONT}`;
    tx.font = font;
    const chars = [...str];
    const widths = chars.map(ch => tx.measureText(ch).width);
    const w = Math.max(1, Math.ceil(widths.reduce((a, b) => a + b, 0) + spacing * Math.max(0, chars.length - 1)) + 2);
    const h = Math.ceil(size * 1.25) + 2;
    tc.width = w; tc.height = h;
    tx.font = font; tx.textBaseline = 'top'; tx.fillStyle = '#fff';
    let cx = 1;
    chars.forEach((ch, i) => { tx.fillText(ch, Math.round(cx), Math.round(size * 0.08)); cx += widths[i] + spacing; });
    const d = tx.getImageData(0, 0, w, h).data;
    const mm = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) mm[i] = d[i * 4 + 3] > thr * 255 ? 1 : 0;
    m = { w, h, m: mm };
    if (cache.size > 3000) cache.clear();
    cache.set(key, m);
    return m;
  }
  function dilate(m, r = 1) {
    const key = m; if (m._dil && m._dil[r]) return m._dil[r];
    const w = m.w + r * 2, h = m.h + r * 2, o = new Uint8Array(w * h);
    for (let j = 0; j < m.h; j++) for (let i = 0; i < m.w; i++) if (m.m[j * m.w + i])
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) o[(j + r + dy) * w + (i + r + dx)] = 1;
    const res = { w, h, m: o, r };
    m._dil = m._dil || {}; m._dil[r] = res; return res;
  }
  // 画文字。opt: weight, align('l'|'c'|'r'), outline(颜色), shadow(颜色), a(透明度), spacing
  function text(R, str, x, y, size, c, opt = {}) {
    if (!str) return { w: 0, h: 0 };
    const m = textMask(str, size, opt.weight || 900, opt.thr || 0.5, opt.spacing || 0);
    let X = x; if (opt.align === 'c') X = x - m.w / 2; else if (opt.align === 'r') X = x - m.w;
    const a = opt.a === undefined ? 1 : opt.a;
    if (opt.shadow !== undefined) R.mask(m, X + (opt.sd || 2), y + (opt.sd || 2), opt.shadow, a);
    if (opt.outline !== undefined) { const d = dilate(m, opt.ow || 1); R.mask(d, X - d.r, y - d.r, opt.outline, a); }
    R.mask(m, X, y, c, a);
    return m;
  }
  function textWidth(str, size, weight = 900, spacing = 0) { return textMask(str, size, weight, 0.5, spacing).w; }

  // ---------- 合成：ART 放大 2 倍 + UI 覆盖（任意尺寸，只要 UI = ART × 2）----------
  function compose(art, ui, out) {
    const ab = art.buf, ub = ui.buf, ob = out.buf, aw = art.w, ow = out.w;
    for (let y = 0; y < out.h; y++) {
      const ar = (y >> 1) * aw, r = y * ow;
      for (let x = 0; x < ow; x++) {
        const u = ub[r + x];
        ob[r + x] = (u >>> 24) ? u : ab[ar + (x >> 1)];
      }
    }
  }

  G.PX = { AW, AH, UW, UH, PORTRAIT, CFG, C, bayer, clamp, lerp, inv, ease, hash, Raster, text, textMask, textWidth, dilate, compose, FONT };
})(window);
