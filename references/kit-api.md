# 组件与版面速查（engine.js / kit.js）

场景函数签名：`draw(A, U, t)`。`A` 是画面层，`U` 是界面层，`t` 是秒。
所有绘制只依赖 `t`，同一个 `t` 永远画出同一帧，所以可以逐帧导出、任意截图。

## 尺寸与版面

| 常量 | 横屏 landscape | 竖屏 portrait |
|---|---|---|
| `AW × AH`（画面层） | 480×270 | 270×480 |
| `UW × UH`（界面层） | 960×540 | 540×960 |
| 输出视频 | 1920×1080 | 1080×1920 |
| `L.footY`（人物脚底最低，A 坐标） | 214 | 312 |
| `L.dlgTop`（单行字幕框顶边，U 坐标） | 432 | 646 |
| `L.dlgBottom`（字幕框底边，U 坐标） | 516 | 730 |
| `L.top`（顶部面板 y，U 坐标） | 16 | 96 |

- `PX.PORTRAIT` 为 true 时是竖屏，场景里可以据此调整构图（例如竖屏把楼群叠高、把两个人物上下排）。
- 竖屏 `L.dlgBottom` 以下约 230px（U 坐标）会被平台的文案和按钮遮挡，只放地面、背景。
- A 坐标 × 2 = U 坐标。

## engine.js（`G.PX`）

- `C('#rrggbb', a)`：颜色；`hash(n)`：确定性随机数；`clamp / lerp / inv(a, b, v) / ease.out|in|inOut|back`。
- `Raster` 方法：`clear(c)`、`px`、`rect`、`drect(x, y, w, h, c, 透明度)`（抖动半透明）、`frame(x, y, w, h, c, 线宽)`、`vgrad(x, y, w, h, c1, c2, 阶数)`、`line`、`circ`、`ellipse`、`halo(cx, cy, r, c, 强度)`（网点光晕）、`sprite(rows, pal, x, y, flip, scale)`、`blitScaled`。
- 图层偏移：给 `A.ox / A.oy` 赋值可以整体平移（做镜头抖动、平移），场景结束后引擎会自动复位。
- `text(R, str, x, y, size, color, opt)`：像素字。`opt`：`weight`、`align: 'l'|'c'|'r'`、`outline`（描边色）、`ow`（描边粗细）、`shadow`、`sd`、`a`（透明度）、`spacing`、`thr`（小字二值化阈值，0.45 更粗）。
- `textWidth(str, size, weight, spacing)`：先量宽度再排版，避免出画。

## kit.js（`G.KIT`，场景里一般写作 `K`）

| 组件 | 用途 |
|---|---|
| `P` | 默认调色板：`black ink night0-2 pink cyan yellow orange red white grey greyD skin hair win win2 green blue uiInk uiWhite` 等 |
| `L` | 版面安全区（见上表） |
| `tag(U, str)` | 左上章节标签 |
| `stats(U, [{label, value 0~1, color}])` | 右上数值面板（每行一个条） |
| `counter(U, label, n, unit)` | 右上计数器 |
| `questLabel(U, str, col)` | 章节标签下方的任务条 |
| `pop(U, str, x, y, t0, t, color, size)` | "+1"浮字 |
| `dialog(U, str, t, t0, {music, speaker, accent})` | 字幕 / 对话框，自动折行、打字机效果 |
| `card(U, big, small, a)` | 居中大字卡片 |
| `stripCard(U, small, big, a)` | 章节横条（`a` 做淡入淡出） |
| `bigCenter(U, str, t0, t, col, size)` | 一闪而过的中央大字（"GO!"、"3"） |
| `achievement(U, t0, t, title, sub)` | 成就弹窗 |
| `panel(U, x, y, w, h, border, fill)` | 通用面板（选项框、背包） |
| `rain(A, t, n, col, speed)` | 雨 |
| `skyline(A, baseY, color, winCols, seed, t, density, camX)` | 楼群（`camX` 做横向卷动） |
| `neonSign(A, {x,y,w,h,txt,col,dark,vertical,size}, lit, t)` + `neonOn(t, tOn)` | 霓虹招牌与点亮闪烁 |
| `person(A, x, 脚底y, look, o)` | Q 版小人。`look`：`hair hairStyle(short/mullet/long/curly/spiky) shirt shirtD pants shoes collar tie helmet band`；`o`：`arm(down/raise/carry/type/bike/none) step nod eyes:'closed' back seated sing blush` |
| `big(A, x, 脚底y, fn, 倍数)` | 把 fn 画的人物整数倍放大 |
| `dim(A, k)` / `flash(A, t, t0, d, col)` | 整屏压暗 / 闪白 |
| `heart(A, x, y, col, s)` | 像素爱心 |
| `beatClock(beats, bpm, shift)` | 返回 `BT(拍号)→秒`、`beatPos(t)`、`pulse(t)`（每拍一次的 0~1 脉冲）、`BEAT` |

## 写场景的小建议

- 按拍号排场景：`S(16, 32, sceneVerse1)`，切换点尽量在 4 的倍数上。
- 节拍动作用 `pulse(t)`（点头、闪灯、数值条跳动），句内动作用 `inv(BT(a), BT(b), t)` 做 0→1 进度。
- 同一个角色的外观定义一次（`HERO`），所有场景复用，封面也会自动用到它。
