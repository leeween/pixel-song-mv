// =====================================================================
//  kit.js — 像素 MV 通用组件（依赖 engine.js 的 window.PX）
//  横屏：画面层 A 480×270，界面层 U 960×540；竖屏：A 270×480，U 540×960
//  版面安全区统一放在 K.L 里（场景代码请用 L.footY / L.dlgTop / L.top，不要写死坐标）
// =====================================================================
(function (G) {
  const { AW, AH, UW, UH, PORTRAIT, C, bayer, clamp, lerp, inv, ease, hash, text, textWidth, Raster } = G.PX;
  // 版面：top = 顶部面板的 y（竖屏避开平台顶栏）；dlgBottom = 字幕框底边（U 坐标）；
  // dlgTop = 单行字幕框顶边（两行时会再往上长约 30px）；footY = 人物脚底最低位置（A 坐标）
  const L = PORTRAIT
    ? { top: 96, side: 16, dlgX: 24, dlgW: UW - 48, dlgBottom: 730, dlgTop: 646, footY: 312 }
    : { top: 16, side: 16, dlgX: 90, dlgW: 780, dlgBottom: 516, dlgTop: 432, footY: 214 };
  const P = {
    black: C('#05050c'), ink: C('#0c0e26'), night0: C('#0a0a1f'), night1: C('#151436'), night2: C('#2a1747'),
    bldFar: C('#1a1838'), bldNear: C('#241f45'), bldNear2: C('#2e2752'),
    pink: C('#ff4f9a'), pinkD: C('#8a1550'), cyan: C('#2de2e6'), cyanD: C('#136f7c'),
    yellow: C('#ffd23f'), yellowD: C('#9a7a1c'), orange: C('#ff8a2a'), red: C('#e5383b'), redD: C('#7d1a22'),
    white: C('#f4efe6'), grey: C('#8a87a6'), greyD: C('#3a3552'), off: C('#3a3350'),
    skin: C('#f2c39b'), skinD: C('#c98d6b'), hair: C('#16111c'),
    win: C('#c9a64a'), win2: C('#4fb3c0'), rain: C('#6f6aa0'),
    wood: C('#6b4630'), woodD: C('#4a3226'), woodDD: C('#3a261c'),
    green: C('#2fbf71'), blue: C('#3d6fd1'),
    uiInk: C('#0c0e26'), uiWhite: C('#f4efe6'), uiShadow: C('#000000'),
  };

  function tag(U, str, a = 1) {
    const w = textWidth(str, 18, 700) + 46, y = L.top;
    U.rect(16, y, w, 34, P.uiInk); U.frame(16, y, w, 34, P.uiWhite, 2);
    // 像素三角 ▶
    for (let i = 0; i < 6; i++) U.rect(28 + i, y + 10 + i, 1, 14 - i * 2, P.pink);
    text(U, str, 42, y + 6, 18, P.uiWhite, { weight: 700, a });
  }
  // 右上角数值面板 items: [{label, value(0~1), color, note}]

  function stats(U, items) {
    const w = 244, x = UW - w - 16, y = L.top, rowH = 38, h = 14 + items.length * rowH;
    U.rect(x, y, w, h, P.uiInk); U.frame(x, y, w, h, P.uiWhite, 2);
    items.forEach((it, i) => {
      const yy = y + 10 + i * rowH;
      text(U, it.label, x + 14, yy, 17, P.uiWhite, { weight: 700 });
      const cells = 10, cx = x + 82, cw = 13, ch = 14;
      const filled = it.value * cells;
      for (let k = 0; k < cells; k++) {
        const X = cx + k * (cw + 2), Y = yy + 4;
        U.rect(X, Y, cw, ch, P.greyD);
        const f = clamp(filled - k);
        if (f > 0) U.rect(X, Y, Math.max(2, Math.round(cw * f)), ch, it.color);
      }
    });
  }
  // 浮动提示（"夢想 +1"）

  function pop(U, str, x, y, t0, t, color, size = 22, life = 1.3) {
    const age = t - t0; if (age < 0 || age > life) return;
    const rise = ease.out(age / 0.5) * 18 + age * 10;
    const a = 1 - inv(life * 0.6, life, age);
    text(U, str, x, y - rise, size, color, { weight: 900, align: 'c', outline: P.uiInk, ow: 2, a });
  }
  // RPG 对话框（歌词 / 旁白）

  // 一句太长时在标点/空格处断成两行，找不到就从中间断
  function splitLine(str) {
    const ch = [...str], mid = ch.length / 2; let best = -1, bd = 1e9;
    ch.forEach((c, i) => { if (i > 0 && i < ch.length - 1 && /[\s，,、。！？!?；;：:]/.test(c)) { const d = Math.abs(i - mid); if (d < bd) { bd = d; best = i; } } });
    if (best < 0 || bd > ch.length * 0.3) { const m = Math.round(mid); return [ch.slice(0, m).join(''), ch.slice(m).join('')]; }
    return [ch.slice(0, best + 1).join('').trimEnd(), ch.slice(best + 1).join('').trimStart()];
  }
  function dialog(U, str, t, t0, opt = {}) {
    const x = L.dlgX, w = L.dlgW, maxW = w - 48;
    const preW = sz => opt.music ? textWidth('♪', sz, 700) + 12 : 0;
    const fits = (s, sz) => textWidth(s, sz, 700) + preW(sz) <= maxW;
    let size = 30, lines = [str];
    if (!fits(str, 30)) {
      size = 26;
      if (!fits(str, 26)) { lines = splitLine(str); size = lines.every(l => fits(l, 26)) ? 26 : 22; }
    }
    const lh = size + 12, h = lines.length === 1 ? 84 : 32 + lh * lines.length, y = L.dlgBottom - h;
    U.rect(x + 6, y + 6, w, h, P.uiShadow);
    U.rect(x, y, w, h, P.uiInk);
    U.frame(x, y, w, h, P.uiWhite, 3);
    U.frame(x + 6, y + 6, w - 12, h - 12, opt.accent || P.cyanD, 1);
    // 四角缺口，做出游戏对话框的味道
    [[x, y], [x + w - 3, y], [x, y + h - 3], [x + w - 3, y + h - 3]].forEach(([a, b]) => U.rect(a, b, 3, 3, 0));
    if (opt.speaker) {
      const sw = textWidth(opt.speaker, 16, 700) + 24;
      U.rect(x + 18, y - 16, sw, 28, opt.accent || P.pink); U.frame(x + 18, y - 16, sw, 28, P.uiWhite, 2);
      text(U, opt.speaker, x + 30, y - 12, 16, P.uiWhite, { weight: 700 });
    }
    // 打字机效果（多行时按总字数推进）
    const total = lines.reduce((n, l) => n + [...l].length, 0);
    const dur = opt.typeDur || Math.min(1.6, total * 0.07);
    let n = Math.ceil(total * clamp((t - t0) / dur));
    const pw = preW(size);
    const blockW = Math.max(...lines.map(l => textWidth(l, size, 700))) + pw;
    const sx = Math.round(x + w / 2 - blockW / 2);
    lines.forEach((l, i) => {
      const ly = lines.length === 1 ? y + (size > 26 ? 22 : 24) : y + 16 + i * lh;
      if (i === 0 && opt.music) text(U, '♪', sx, ly + (size > 26 ? 2 : 0), size, P.yellow, { weight: 700, shadow: P.uiShadow, sd: 2 });
      const cs = [...l], k = Math.max(0, Math.min(cs.length, n)); n -= k;
      if (k) text(U, cs.slice(0, k).join(''), sx + pw, ly, size, P.uiWhite, { weight: 700, shadow: P.uiShadow, sd: 2 });
    });
    if ((t - t0) >= dur && Math.floor(t * 2.5) % 2 === 0) {
      for (let i = 0; i < 5; i++) U.rect(x + w - 34 + i, y + h - 22 + i, 10 - i * 2, 1, P.yellow);
    }
  }
  // 居中大字卡片（章节过场）

  function card(U, big, small, a = 1, col = P.pink) {
    text(U, small, UW / 2, UH / 2 - 60, 24, P.uiWhite, { weight: 700, align: 'c', a });
    text(U, big, UW / 2, UH / 2 - 20, 52, col, { weight: 900, align: 'c', outline: P.uiWhite, ow: 2, a, spacing: 6 });
  }

  function rain(A, t, n = 110, col = P.rain, speed = 230) {
    for (let i = 0; i < n; i++) {
      const x0 = hash(i * 3.1) * (AW + 40) - 20;
      const y = ((hash(i * 7.7) * (AH + 20) + t * speed * (0.8 + hash(i) * 0.4)) % (AH + 20)) - 10;
      const x = x0 - (y * 0.15);
      A.px(x, y, col); A.px(x, y + 1, col); A.px(x - 1, y + 2, col); A.px(x - 1, y + 3, col);
    }
  }
  // 远景楼群

  function skyline(A, baseY, color, winCols, seed, t, density = 0.28, camX = 0) {
    let x = -40 + ((camX % 1) || 0);
    for (let i = 0; x < AW + 40; i++) {
      const w = 18 + Math.floor(hash(seed + i) * 26), h = 50 + Math.floor(hash(seed + i * 1.7) * 90);
      const X = Math.round(x + camX);
      A.rect(X, baseY - h, w, h, color);
      for (let wy = baseY - h + 5; wy < baseY - 4; wy += 6) for (let wx = X + 3; wx < X + w - 3; wx += 5) {
        const k = seed * 13 + i * 97 + wx * 3 + wy * 7;
        if (hash(k) < density) {
          const flick = hash(k + Math.floor(t * 0.5 + hash(k) * 10)) < 0.97;
          if (flick) A.rect(wx, wy, 2, 2, winCols[Math.floor(hash(k * 1.3) * winCols.length)]);
        }
      }
      x += w + 2;
    }
  }
  // 霓虹招牌：lit = 0 熄灭，1 点亮；flicker 时随机闪

  function neonSign(A, s, lit, t) {
    const { x, y, w, h, txt, col, dark, vertical, size } = s;
    if (lit > 0) A.halo(x + w / 2, y + h / 2, Math.max(w, h) * 0.9, col, 0.22 * lit);
    A.rect(x, y, w, h, P.ink);
    A.frame(x, y, w, h, lit ? col : P.off, 1);
    A.frame(x + 2, y + 2, w - 4, h - 4, lit ? dark : P.night1, 1);
    const tc = lit ? col : P.off;
    const chars = [...txt];
    if (vertical) {
      const step = (h - 8) / chars.length;
      chars.forEach((ch, i) => text(A, ch, x + w / 2, y + 4 + i * step + (step - size * 1.2) / 2, size, tc, { align: 'c', thr: 0.45 }));
    } else {
      text(A, txt, x + w / 2, y + (h - size * 1.25) / 2, size, tc, { align: 'c', thr: 0.45, spacing: 2 });
    }
    // 支架
    A.rect(vertical ? x + w / 2 - 1 : x - 6, vertical ? y - 6 : y + h / 2, vertical ? 2 : 6, vertical ? 6 : 2, P.greyD);
  }
  // 霓虹点亮的闪烁曲线

  function neonOn(t, tOn) {
    if (t < tOn) return 0;
    const k = t - tOn;
    if (k > 0.45) return 1;
    return hash(Math.floor(t * 24) + tOn * 10) > 0.45 ? 1 : 0;
  }

  // ---------- 人物（Q 版、无具体五官 —— 虚构乐队成员） ----------
  // look: {hair, hairStyle, shirt, pants, shoes}

  function person(A, x, by, look, o = {}) {
    x = Math.round(x); by = Math.round(by);
    const nod = o.nod ? 1 : 0;
    const legH = 15, bodyH = 17, headH = 16;
    // 腿
    if (!o.seated) {
      const st = o.step || 0;
      A.rect(x - 7, by - legH + (st > 0 ? -1 : 0), 6, legH, look.pants);
      A.rect(x + 1, by - legH + (st < 0 ? -1 : 0), 6, legH, look.pants);
      A.rect(x - 8, by - 2 + (st > 0 ? -1 : 0), 7, 2, look.shoes || P.hair);
      A.rect(x + 1, by - 2 + (st < 0 ? -1 : 0), 7, 2, look.shoes || P.hair);
    }
    const bTop = by - legH - bodyH;
    // 身体
    A.rect(x - 9, bTop, 18, bodyH, look.shirt);
    A.rect(x + 6, bTop, 3, bodyH, look.shirtD || look.shirt);
    if (look.collar) A.rect(x - 3, bTop, 6, 3, look.collar);
    if (look.tie) A.rect(x - 1, bTop + 2, 2, 10, look.tie);
    // 手臂
    const arm = o.arm || 'down';
    const sk = P.skin;
    if (arm === 'down') { A.rect(x - 12, bTop + 1, 3, 13, look.shirt); A.rect(x - 12, bTop + 14, 3, 3, sk); A.rect(x + 9, bTop + 1, 3, 13, look.shirt); A.rect(x + 9, bTop + 14, 3, 3, sk); }
    if (arm === 'raise') { A.rect(x - 12, bTop + 1, 3, 13, look.shirt); A.rect(x - 12, bTop + 14, 3, 3, sk); }
    if (arm === 'carry') { A.rect(x - 12, bTop - 2, 3, 8, look.shirt); A.rect(x + 9, bTop + 1, 3, 13, look.shirt); A.rect(x + 9, bTop + 14, 3, 3, sk); }
    if (arm === 'type') { const s = o.alt ? 1 : 0; A.rect(x - 12, bTop + 6, 8, 3, look.shirt); A.rect(x - 15, bTop + 6 + s, 3, 3, sk); A.rect(x + 4, bTop + 6, 8, 3, look.shirt); A.rect(x + 12, bTop + 7 - s, 3, 3, sk); }
    if (arm === 'bike') { A.rect(x - 4, bTop + 3, 18, 3, look.shirt); A.rect(x + 13, bTop + 4, 3, 3, sk); }
    // 头
    const hy = bTop - headH + nod;
    A.rect(x - 9, hy, 18, headH, sk);
    A.rect(x + 6, hy, 3, headH, P.skinD);
    // 发型
    const hc = look.hair || P.hair, hs = look.hairStyle || 'short';
    if (o.back) { // 背影：整个后脑勺都是头发
      A.rect(x - 10, hy - 3, 20, headH - 1, hc);
      if (hs === 'long' || hs === 'mullet') A.rect(x - 10, hy + 10, 20, 8, hc);
    } else {
      if (hs === 'short') { A.rect(x - 10, hy - 3, 20, 6, hc); A.rect(x - 10, hy, 3, 6, hc); A.rect(x + 7, hy, 3, 6, hc); }
      if (hs === 'mullet') { A.rect(x - 10, hy - 3, 20, 6, hc); A.rect(x - 11, hy, 4, 15, hc); A.rect(x + 7, hy, 4, 15, hc); A.rect(x - 6, hy + 2, 6, 2, hc); }
      if (hs === 'long') { A.rect(x - 11, hy - 3, 22, 6, hc); A.rect(x - 12, hy, 4, 20, hc); A.rect(x + 8, hy, 4, 20, hc); }
      if (hs === 'curly') { for (let i = -12; i <= 10; i += 4) A.rect(x + i, hy - 5 + ((i / 4) & 1), 5, 7, hc); A.rect(x - 12, hy, 4, 10, hc); A.rect(x + 8, hy, 4, 10, hc); }
      if (hs === 'spiky') { A.rect(x - 10, hy - 2, 20, 5, hc); for (let i = -9; i <= 7; i += 4) { A.rect(x + i, hy - 5, 2, 3, hc); A.rect(x + i + 1, hy - 7, 1, 2, hc); } }
      if (look.helmet) { A.rect(x - 11, hy - 5, 22, 7, look.helmet); A.rect(x - 13, hy + 1, 26, 2, look.helmet); }
      if (look.band) A.rect(x - 10, hy + 1, 20, 2, look.band);
      // 极简五官：两点眼睛
      const eyeY = hy + 8;
      if (o.eyes === 'closed') { A.rect(x - 5, eyeY + 1, 3, 1, P.hair); A.rect(x + 2, eyeY + 1, 3, 1, P.hair); }
      else { A.rect(x - 5, eyeY, 2, 2, P.hair); A.rect(x + 3, eyeY, 2, 2, P.hair); }
      if (o.sing) A.rect(x - 1, hy + 12, 3, 2, P.redD);
      if (o.blush) { A.rect(x - 8, hy + 11, 2, 1, C('#e88a8a')); A.rect(x + 6, hy + 11, 2, 1, C('#e88a8a')); }
    }
    if (arm === 'raise') { A.rect(x + 9, bTop + 1, 5, 3, look.shirt); A.rect(x + 12, bTop - 10, 3, 13, look.shirt); A.rect(x + 11, bTop - 16, 6, 6, sk); A.rect(x + 11, bTop - 16, 6, 1, P.skinD); }
    return { headY: hy, bodyTop: bTop };
  }

  function counter(U, label, n, unit = '人') {
    const w = 200, h = 74, x = UW - w - 16, y = L.top;
    U.rect(x, y, w, h, P.uiInk); U.frame(x, y, w, h, P.uiWhite, 2);
    text(U, label, x + 16, y + 10, 16, P.uiWhite, { weight: 700 });
    text(U, String(n), x + w - 52, y + 24, 38, P.yellow, { weight: 900, align: 'r' });
    text(U, unit, x + w - 18, y + 40, 18, P.uiWhite, { weight: 700, align: 'r' });
  }

  function questLabel(U, str, col = P.yellow) {
    const lw = textWidth(str, 16, 700) + 28;
    U.rect(16, L.top + 42, lw, 28, col); text(U, str, 30, L.top + 46, 16, P.uiInk, { weight: 700 });
  }
  // 章节横条（黑色宽条 + 大字）

  function stripCard(U, small, big, a) {
    if (a <= 0) return;
    const c = Math.round(UH / 2);
    for (let y = c - 70; y < c + 60; y++) for (let x = 0; x < UW; x++) if (bayer(x, y) < a * 0.85) U.px(x, y, P.black);
    text(U, small, UW / 2, c - 56, 22, P.uiWhite, { weight: 700, align: 'c', a });
    text(U, big, UW / 2, c - 24, 54, P.pink, { weight: 900, align: 'c', outline: P.uiWhite, ow: 2, a, spacing: 8 });
  }

  function bigCenter(U, str, t0, t, col = P.yellow, size = 96) {
    const age = t - t0; if (age < 0 || age > 0.42) return;
    const s = Math.round(size * (1.3 - 0.3 * ease.out(age / 0.15)));
    text(U, str, UW / 2, UH / 2 - 40 - s / 2, s, col, { weight: 900, align: 'c', outline: P.uiInk, ow: 3, a: 1 - inv(0.3, 0.42, age) });
  }

  // 人物放大绘制：fn 在临时画布上以 (110,140) 为脚底中心作画，再整数倍放大贴到画面
  const TMP = new Raster(220, 150);
  function big(A, x, by, fn, s = 2) { TMP.clear(0); fn(TMP, 110, 140); A.blitScaled(TMP, s, Math.round(x - 110 * s), Math.round(by - 140 * s)); }
  function panel(U, x, y, w, h, border = P.uiWhite, fill = P.uiInk) { U.rect(x + 5, y + 5, w, h, P.uiShadow); U.rect(x, y, w, h, fill); U.frame(x, y, w, h, border, 3); }
  function dim(A, k, col = P.black) { if (k > 0) for (let y = 0; y < A.h; y++) for (let x = 0; x < A.w; x++) if (bayer(x, y) < k) A.px(x, y, col); }
  function flash(A, t, t0, d = 0.25, col = P.white, k = 1) { const f = 1 - inv(t0, t0 + d, t); if (f > 0 && t >= t0) A.drect(0, 0, AW, AH, col, f * k); }
  const HEART = ['.xx.xx.', 'xxxxxxx', 'xxxxxxx', '.xxxxx.', '..xxx..', '...x...'];
  const heart = (A, x, y, col, s = 1) => A.sprite(HEART, { x: col }, Math.round(x), Math.round(y), false, s);
  function achievement(U, t0, t, title, sub) {
    const ak = inv(t0, t0 + 0.4, t); if (ak <= 0) return;
    const w = Math.min(560, UW - 40), h = 96, x = Math.round((UW - w) / 2), y = Math.round(lerp(-110, L.top + 88, ease.back(ak)));
    U.rect(x + 6, y + 6, w, h, P.uiShadow); U.rect(x, y, w, h, P.uiInk); U.frame(x, y, w, h, P.yellow, 3);
    U.rect(x + 28, y + 22, 34, 22, P.yellow); U.rect(x + 40, y + 44, 10, 10, P.yellowD); U.rect(x + 32, y + 54, 26, 6, P.yellow);
    text(U, title, x + 92, y + 16, 18, P.yellow, { weight: 900 }); text(U, sub, x + 92, y + 44, 28, P.uiWhite, { weight: 900 });
  }
  // ---------- 节拍工具：基于逐拍跟踪的 beats 数组（秒）----------
  function beatClock(beats, bpm, shift = 0) {
    const NB = beats.length, BEAT = 60 / bpm;
    const BT0 = k => k <= 0 ? beats[0] + k * BEAT : k >= NB - 1 ? beats[NB - 1] + (k - NB + 1) * BEAT : lerp(beats[Math.floor(k)], beats[Math.floor(k) + 1], k - Math.floor(k));
    const pos0 = t => { if (t <= beats[0]) return (t - beats[0]) / BEAT; if (t >= beats[NB - 1]) return NB - 1 + (t - beats[NB - 1]) / BEAT; let lo = 0, hi = NB - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (beats[m] <= t) lo = m; else hi = m; } return lo + (t - beats[lo]) / (beats[hi] - beats[lo]); };
    const BT = k => BT0(k + shift), beatPos = t => pos0(t) - shift;
    const pulse = (t, k = 5) => { const b = beatPos(t); return b < -shift ? 0 : Math.exp(-(b - Math.floor(b)) * k); };
    return { BT, beatPos, pulse, BEAT };
  }
  G.KIT = { P, L, splitLine, tag, stats, pop, dialog, card, rain, skyline, neonSign, neonOn, person, big, TMP, counter, questLabel, stripCard, bigCenter, panel, dim, flash, heart, achievement, beatClock };
})(window);
