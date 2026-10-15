// =====================================================================
//  scenes.js —— 本首歌的分镜（模板，每首歌重写）
//  每个场景 draw(A, U, t)：A = 画面层，U = 界面层（尺寸见 PX.AW/AH/UW/UH，随 config.js 横竖屏变化）
//  版面一律用 K.L：人物脚底 ≤ L.footY（A 坐标），重要元素不要低于 L.dlgTop（U 坐标），顶部面板从 L.top 开始
//  拍号 k → 秒：BT(k)；当前拍：beatPos(t)；节拍脉冲：pulse(t)
// =====================================================================
(function (G) {
  const { AW, AH, UW, UH, PORTRAIT, C, bayer, clamp, lerp, inv, ease, hash, text, textWidth } = G.PX;
  const K = G.KIT, P = K.P, L = K.L, TM = G.MV_TIMING;
  const { BT, beatPos, pulse, BEAT } = K.beatClock(TM.beats, TM.bpm, TM.shift || 0);
  const { tag, stats, pop, dialog, rain, skyline, neonSign, person, big, stripCard, bigCenter, panel, flash } = K;

  // ---- 片名与可选的系列编号（不需要编号就留空字符串）----
  const TITLE = '歌名';
  const EP = '';            // 例如 '存档 03' / 'STAGE 2'

  // ---- 主角（虚构人物）：look = { hair, hairStyle: short|mullet|long|curly|spiky, shirt, shirtD, pants, shoes } ----
  const HERO = { hair: P.hair, hairStyle: 'short', shirt: C('#5aa0e6'), shirtD: C('#3f7cc0'), pants: C('#2c3f73'), shoes: P.hair };
  const hero = (T, x, by, o = {}) => person(T, x, by, HERO, o);   // o: { arm: down|raise|carry|type|bike|none, step, nod, eyes:'closed', back, seated, sing, blush }

  function sceneTitle(A, U, t) {
    A.vgrad(0, 0, AW, AH, C('#0a0a1f'), C('#2a1747'), 7);
    skyline(A, AH, C('#151436'), [C('#c9a64a'), C('#4fb3c0')], 7, t, 0.25);
    rain(A, t, PORTRAIT ? 70 : 80, P.greyD, 160);
    // 片名放在人物头顶上方：横屏空间紧，片名靠上、编号紧贴片名下方
    const ts = PORTRAIT ? 64 : 76, ty = Math.round(UH * (PORTRAIT ? 0.2 : 0.1));
    text(U, TITLE, UW / 2, ty, ts, P.pink, { weight: 900, align: 'c', outline: P.uiWhite, ow: 3, spacing: 6 });
    if (EP) text(U, EP, UW / 2, ty + ts + 22, 18, P.yellow, { weight: 900, align: 'c', spacing: 4 });
    big(A, AW / 2, L.footY, (T, x, by) => hero(T, x, by, { nod: pulse(t) > 0.5 }));
  }

  // 示例：带游戏界面的街景（左上章节标签 + 右上数值面板 + 节拍点头的主角）
  function sceneStreet(A, U, t) {
    A.vgrad(0, 0, AW, AH, C('#0a0a1f'), C('#151436'), 6);
    skyline(A, L.footY + 4, P.bldFar, [P.win, P.win2], 3, t, 0.3, -t * 6);   // 楼群贴着地面线，横竖屏都适用
    A.rect(0, L.footY, AW, AH - L.footY, P.ink);
    big(A, AW / 2, L.footY, (T, x, by) => hero(T, x, by, { step: Math.floor(beatPos(t)) % 2 ? 1 : -1, nod: pulse(t) > 0.5 }));
    tag(U, '第一章');
    stats(U, [{ label: '勇气', value: clamp(inv(BT(8), BT(24), t)), color: P.pink }, { label: '体力', value: 0.6, color: P.cyan }]);
  }

  // 分镜表：S(起始拍, 结束拍, draw)，场景切换尽量卡在小节线（4 的倍数）上
  const S = (a, b, draw) => ({ start: a === 0 ? 0 : BT(a), end: BT(b), draw });
  const SCENES = G.MV_SCENES = [
    S(0, 8, sceneTitle),
    S(8, 9999, sceneStreet),
  ];
  function drawLyrics(U, t) { for (const l of TM.lyrics) if (t >= l.start && t < l.end + 0.08) { dialog(U, l.text, t, l.start, { music: true }); return; } }
  G.MV = {
    render(A, U, t) {
      A.ox = A.oy = 0; U.ox = U.oy = 0; A.clear(P.black); U.clear(0);
      const s = SCENES.find(s => t >= s.start && t < s.end); if (s) s.draw(A, U, t);
      A.ox = A.oy = 0; drawLyrics(U, t);
    },
    sections: TM.sections, duration: TM.duration,
    hero, title: TITLE, ep: EP,   // 封面 cover.html 会用到
  };
})(window);
