// Original 12-second technical demo; deterministic draws, no external art.
(function (G) {
  const { AW, AH, UW, UH, C, clamp, inv, lerp, text } = PX;
  const K = KIT, P = K.P, L = K.L, TM = G.MV_TIMING;
  const look = { hair: P.hair, shirt: C('#efb34f'), shirtD: C('#b97a37'), pants: C('#284653'), shoes: P.hair };
  const hero = (A, x, y, opt) => K.person(A, x, y, look, opt);
  function draw(A, U, t) {
    A.clear(P.black); U.clear(0);
    A.vgrad(0, 0, AW, AH, C('#101c35'), C('#305265'), 7);
    for (let i = 0; i < 36; i++) A.px((i * 83 + 17) % AW, 12 + (i * 43) % Math.round(AH * .4), P.uiWhite);
    const ground = L.footY, tx = Math.round(AW * .78), top = ground - 100;
    A.rect(0, ground, AW, AH - ground, C('#132d32'));
    A.rect(0, ground + 6, AW, 2, C('#3c6262'));
    A.rect(tx - 14, top, 28, 100, C('#617e86'));
    A.rect(tx + 7, top, 7, 100, C('#3e5a6a'));
    A.rect(tx - 21, top - 18, 42, 18, C('#1d3547'));
    A.rect(tx - 17, top - 32, 34, 14, C('#c07756'));
    const lit = t >= 6;
    if (lit) {
      A.halo(tx, top - 10, 76, P.yellow, .8, 2);
      A.rect(tx - 16, top - 15, 32, 11, P.yellow);
    } else A.rect(tx - 16, top - 15, 32, 11, C('#385263'));
    const hx = Math.round(lerp(AW * .28, AW * .55, inv(4, 6, t)));
    K.big(A, hx, ground, (T, x, by) => hero(T, x, by, { arm: t >= 2 ? 'raise' : 'down', step: t >= 4 && t < 6 ? Math.floor(t * 8) % 2 ? 1 : -1 : 0 }));
    if (t >= 2 && t < 6) {
      const sx = hx + 28, sy = ground - 104;
      A.halo(sx, sy, 22, P.yellow, .65, 2);
      A.rect(sx - 2, sy - 6, 4, 12, P.yellow); A.rect(sx - 6, sy - 2, 12, 4, P.yellow);
    }
    K.tag(U, t < 2 ? '新游戏' : t < 4 ? '拾起星光' : t < 6 ? '带上勇气' : t < 8 ? '灯塔点亮' : '任务完成');
    K.stats(U, [{ label: '微光', value: clamp((t - 2) / 4), color: P.yellow }]);
    if (t < 2) {
      text(U, '微光存档', UW / 2, Math.round(UH * .2), 52, P.yellow, { align: 'c', outline: P.ink, ow: 2 });
      text(U, 'START / 点亮远方', UW / 2, Math.round(UH * .2) + 74, 20, P.uiWhite, { align: 'c' });
    }
    for (const l of TM.lyrics) if (t >= l.start && t < l.end) K.dialog(U, l.text, t, l.start, { music: true });
    if (t >= 8) K.achievement(U, 8, t, '存档完成', '微光 +1');
    if (t > 10.5) { K.dim(A, inv(10.5, 12, t)); K.dim(U, inv(10.5, 12, t)); }
  }
  G.MV = { render: draw, duration: TM.duration, sections: TM.sections, title: '微光存档', ep: '', hero };
})(window);
