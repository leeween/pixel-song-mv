# Pixel Song MV · 像素游戏风歌曲 MV

把用户提供的歌曲音频与歌词，制作成有因果和递进的原创像素游戏故事：大人物、RPG 歌词对话框、节拍同步的动作与游戏事件。

默认输出 **16:9 / 1920×1080 / 30fps**，支持竖屏、3:4 封面、完整音频网页预览和可修改工程。这是供 AI 编码助手使用的 skill 与渲染工具，不是一键自动生成完整剧情的独立应用。

![原创示例：微光存档](docs/minimal-preview.png)

## 成片与示例

- [原创可运行示例：微光存档](examples/minimal/README.md)：12 秒合成音轨，含原创字幕、分镜、时间轴和生成程序，可自行重新导出。
- [既有成片说明](demo/README.md)：本地保存的《Baby》《我是真的愛上你》制作效果记录。歌曲和歌词的授权独立于代码许可，视频默认不随 Git 和源码 ZIP 分发。

原创示例无真人声，因此用于验证渲染、播放和时间轴，不代表自动歌词对齐效果。

## 安装 skill

先下载或克隆仓库，将完整文件夹保持为 `pixel-song-mv`，不要只复制 `SKILL.md`。

| 助手 | 用户级安装目录 |
|---|---|
| Codex | `~/.agents/skills/pixel-song-mv/` |
| Claude Code | `~/.claude/skills/pixel-song-mv/` |

Codex 项目级安装可放到项目的 `.agents/skills/pixel-song-mv/`。Windows 的 `~` 是用户目录。安装后用 `$pixel-song-mv` 显式调用，或提出“把这首歌做成像素游戏风 MV”的请求。

Claude 网页版等受托管环境是否支持完整导出，取决于当前文件执行、浏览器和 ffmpeg 权限；本项目以能运行本地命令的编码助手为主要使用环境。

## 运行依赖

- Volta 管理的 Node.js（项目固定 24.13.1），pnpm 10.30.1；不使用全局 npm 安装。
- Playwright 1.59.1 与匹配的 Chromium，由锁文件固定。
- Python 3.11+。音频分析需要 `requirements.txt` 的 NumPy、SciPy、Matplotlib。
- ffmpeg（建议 6+，需 libx264 和 AAC 编码支持）；ffprobe 可用于额外检查。
- 中文字体，如系统雅黑、苹方、Noto Sans CJK 或思源黑体。不随仓库分发字体和浏览器。

准备好 Volta 后，在仓库根目录执行：

```sh
volta install node@24.13.1
volta install pnpm@10.30.1
pnpm install --frozen-lockfile
pnpm browser:install
```

先检查已有环境和锁文件，复用依赖及浏览器缓存。如果 Volta 提示 pnpm 支持未开启，按 Volta 的 pnpm 支持方式配置 `VOLTA_FEATURE_PNPM=1` 后重开终端。

音频分析用虚拟环境安装，避免修改系统 Python：

**Windows / PowerShell：**

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

**macOS / Linux：**

```sh
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
```

下文 `python` 指虚拟环境里的 Python，或直接用上述完整路径替换。最小示例生成程序只依赖 Python 标准库。

检查 ffmpeg：`ffmpeg -version`。不在 PATH 时，可在 PowerShell 设置 `$env:FFMPEG_PATH = 'ffmpeg可执行文件的完整路径'`，或在 bash 设置 `export FFMPEG_PATH='/path/to/ffmpeg'`。已有兼容 Chromium 可通过 `CHROME_PATH` 指定；通常无需设置。

## 三步运行原创示例

在仓库根目录：

```sh
python scripts/create_example.py
pnpm render --project output/minimal --stills 1,3,5,7,9
pnpm render --project output/minimal --out mv.mp4
```

打开 `output/minimal/index.html` 可播放、暂停、拖动或按章节跳转；也可在仓库根目录运行 `python -m http.server 8000 --bind 127.0.0.1`，访问 `http://127.0.0.1:8000/output/minimal/`。

生成目录已存在时程序会停止，保护已有修改。再次生成用 `python scripts/create_example.py --out output/another`。

封面导出：

```sh
pnpm render --project output/minimal --page cover.html --stills 0 --scale 2 --name cover.png
```

输出 `mv.mp4` 为 1920×1080，封面为 1080×1440。修改生成目录 `config.js` 的 `format` 为 `portrait`，即可验证竖屏；每种画幅都应重新检查构图。

## 制作自己的 MV

将音频与逐句歌词交给助手，例如：

> 使用 pixel-song-mv，把我提供的音频和歌词做成横屏 MV。以原创人物探索废弃空间站为主线，让每次副歌的选择产生不同结果。先给出故事方案。

助手按 `SKILL.md` 分析歌曲、设计故事、生成时间轴和场景，再导出。输出工程包含音频、网页、源码、时间轴、依赖清单和锁文件；不包含 node_modules 或虚拟环境。

如果手动操作：复制 `assets/` 为歌曲工程，在 `config.js` 设置 `audio`、`format`、`script`，提供 `lyrics.txt` 与 `plan.json`，并重写 `scenes.js`。工程在本仓库内时可直接共用根目录依赖。

```sh
python scripts/analyze.py beats output/my-song/song.mp3 output/my-song/an
python scripts/analyze.py build output/my-song/an output/my-song/plan.json output/my-song/lyrics.txt --output output/my-song/lyrics.js
python scripts/analyze.py vocals output/my-song/an output/my-song/lyrics.js 25-60 60-95
pnpm render --project output/my-song --out mv.mp4
```

`plan.json` 的完整例子见 [示例时间轴](examples/minimal/plan.json)。`shift` 单位为拍，正数推迟；修改后重新 build，歌词、章节和场景才会一致。不要只改生成的 `lyrics.js` 中的 shift。`--output` 会直接写 UTF-8，兼容 Windows 的编码习惯。

导出参数：

| 参数 | 用途 |
|---|---|
| `--project 路径` | 工程目录；仓库根目录调用时使用 |
| `--start 秒 --end 秒` | 导出部分时间；默认整片 |
| `--fps 数字` | 默认 30 |
| `--audio 文件名` | 覆盖 config.js 中的音频 |
| `--out 文件名` | 默认 mv.mp4 |
| `--stills 1,3,5` | 导出指定时刻的 PNG |
| `--page cover.html --stills 0 --scale 2 --name cover.png` | 导出封面 |

独立工程交付时带上根目录 `package.json`、`pnpm-lock.yaml`、许可证和授权说明，将 `render` 脚本调整为 `node render.mjs`。安装后用 `pnpm render`，或 `pnpm exec node render.mjs`。示例生成程序已经完成此配置。

## 验证与限制

```sh
python -m unittest discover -s tests -p 'test_*.py'
pnpm test
pnpm test:smoke
```

Windows 的集成检查默认使用 `.venv/Scripts/python.exe`；可通过 `PYTHON` 环境变量覆盖。检查会在 `output/qa-*` 生成原创工程，验证横竖屏实际播放、暂停、章节跳转、拖动、截图、30fps 视频及音轨、整片解码、封面尺寸和 ffmpeg 失败退出。GitHub Actions 配置包含 Windows 与 Linux 检查。

- 节拍估计可能有半速或倍速误差；中置人声比例与音高图不等于可靠的歌词强制对齐，需结合音频校准。
- 分析少于 4 秒或无节拍变化的输入会明确报错。这类片段可手动设置时间轴。
- 超长句即使折成两行仍可能需要调整字体和版面；不同系统字体会产生细微差异。
- 完整 MV 的故事、作画和歌词时间需要助手或人工创作，导出速度随机器变化。

## 许可证与 GitHub 发布

项目代码、文档及原创示例采用 [MIT](LICENSE)。歌曲、歌词、字体及依赖的授权范围见 [NOTICE.md](NOTICE.md)。如有从其他项目引入的代码，发布前应保留其原始许可证和署名。

源码 ZIP 可直接生成：

```sh
python scripts/package_skill.py
```

得到 `dist/pixel-song-mv-0.1.0.zip`，带单一顶层文件夹，排除现有歌曲成片、输出、依赖、缓存和私人环境配置。可作为 GitHub Release 的附件，或解压后安装为 skill。

推送前运行上述验证并审阅待提交文件。创建 GitHub 仓库后，再设置其 remote、提交并推送；本项目不保存账号凭据。维护方式见 [CONTRIBUTING.md](CONTRIBUTING.md)。
