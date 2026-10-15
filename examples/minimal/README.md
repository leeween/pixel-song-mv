# 微光存档：12 秒可运行示例

原创合成音轨，无人声，120 BPM。字幕是原创叙事句，用于验证时间轴和 RPG 对话框，不代表自动听写或自动歌词对齐。

| 时间 | 事件 |
|---|---|
| 0–2 秒 | 标题与任务开始，灯塔尚未点亮 |
| 2–4 秒 | 拾起微光，道具出现 |
| 4–6 秒 | 带着微光靠近灯塔 |
| 6–8 秒 | 灯塔点亮，画面产生反馈 |
| 8–12 秒 | 达成成就，存档并淡出 |

在仓库根目录生成工程：`python scripts/create_example.py`。输出目录存在时不会覆盖，可用 `--out output/another` 另建。

打开生成目录的 `index.html` 预览。仓库根目录导出：

```sh
pnpm render --project output/minimal --out mv.mp4
pnpm render --project output/minimal --page cover.html --stills 0 --scale 2 --name cover.png
```

如果收到的是独立工程包，在本目录运行 `pnpm install --frozen-lockfile`、`pnpm browser:install`，然后 `pnpm render --out mv.mp4`。Node 由 Volta 管理；ffmpeg 必须在 PATH 中，或通过 `FFMPEG_PATH` 指定路径。播放合成音轨不需要 Python 科学计算依赖。

修改 `config.js` 的 `format` 可切换画幅，修改 `audio` 可切换音频文件。原创示例代码、字幕和生成的音轨遵循仓库 MIT 许可。
