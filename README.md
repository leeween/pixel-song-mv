# Pixel Song MV

将歌曲和歌词制作成原创像素游戏剧情 MV：大人物、RPG 歌词对话框、节拍同步的动作，以及随歌词推进的游戏故事。

默认导出 **1920×1080 / 30fps** 视频，并提供封面、网页预览和可修改工程；也支持竖屏。

![像素 MV 示例：微光存档](docs/minimal-preview.png)

## 安装

下载或克隆本仓库，将完整的 `pixel-song-mv` 文件夹放入助手的技能目录：

| 助手 | 安装目录 |
|---|---|
| Codex | `~/.agents/skills/pixel-song-mv/` |
| Claude Code | `~/.claude/skills/pixel-song-mv/` |

Windows 中的 `~` 指用户目录。Codex 项目级技能也可放在项目的 `.agents/skills/` 下。

## 使用

提供歌曲音频和逐句歌词，告诉助手你想要的故事方向：

> 使用 pixel-song-mv，把这首歌做成横屏像素 MV。主角是一名修复灯塔的旅人，每次副歌都让任务向前推进。先给我故事方案。

助手会分析歌曲、设计分镜、制作场景，再导出视频、封面和工程。歌词时间需要结合音频校准。

## 运行示例

仓库附带一个 **12 秒的原创示例《微光存档》**，使用合成音轨和原创字幕，可直接生成并重新导出。

需要 Volta 管理的 Node.js、pnpm、Python 3.11+、ffmpeg 和中文字体。在仓库根目录执行：

```sh
pnpm install --frozen-lockfile
pnpm browser:install
python scripts/create_example.py
pnpm render --project output/minimal --out mv.mp4
```

打开 `output/minimal/index.html` 预览，导出的视频位于 `output/minimal/mv.mp4`。

- [示例说明](examples/minimal/README.md)：剧情时间表、封面导出和画幅切换。
- [使用指南](references/usage.md)：环境安装、歌词时间轴、手动制作和导出参数。
- [参与贡献](CONTRIBUTING.md)：测试与打包流程。

## 许可

代码、文档及原创示例采用 [MIT 许可证](LICENSE)。歌曲和歌词需另行取得相应授权，详见 [素材授权说明](NOTICE.md)。
