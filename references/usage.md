# 使用指南

## 环境准备

Node.js 使用 Volta 管理，依赖使用 pnpm。项目版本记录在 `package.json`，安装时使用已有锁文件：

```sh
volta install node@24.13.1
volta install pnpm@10.30.1
pnpm install --frozen-lockfile
pnpm browser:install
```

若 Volta 提示 pnpm 支持未开启，设置 `VOLTA_FEATURE_PNPM=1` 后重开终端。Playwright 会复用匹配版本的浏览器缓存。

需要 Python 3.11+。最小示例生成程序只依赖标准库；分析自己的歌曲时，另在虚拟环境中安装科学计算依赖。

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

后文 `python` 指虚拟环境里的 Python，可用上述完整路径替换；仅生成示例时也可使用系统的 `python` 或 `python3`。

ffmpeg 建议 6+，需支持 libx264 和 AAC。用 `ffmpeg -version` 检查；中文字体可用系统雅黑、苹方、Noto Sans CJK 或思源黑体。

如果 ffmpeg 不在 PATH，可设置其完整路径：

```powershell
$env:FFMPEG_PATH = 'C:\tools\ffmpeg\bin\ffmpeg.exe'
```

```sh
export FFMPEG_PATH='/path/to/ffmpeg'
```

如需使用已有兼容 Chromium，可通过 `CHROME_PATH` 指定其可执行文件。完整导出需要能够运行本地命令、浏览器与 ffmpeg 的环境。

## 手动制作

每首歌建立独立工程目录，例如 `output/my-song/`，复制 `assets/` 下的模板文件，并准备：

| 文件 | 内容 |
|---|---|
| 原始音频 | 用户提供的 mp3、m4a 或 wav |
| `config.js` | `audio` 音频文件名、`format` 画幅、`script` 字体语言 |
| `lyrics.txt` | UTF-8 歌词，每行一句 |
| `plan.json` | 歌词和章节对应的拍号，参考[示例](../examples/minimal/plan.json) |
| `scenes.js` | 按歌词设计的角色、事件和分镜 |

绘图接口见 [组件说明](kit-api.md)，完整制作流程见 [SKILL.md](../SKILL.md)。工程位于仓库内时，可共用根目录依赖。

在仓库根目录依次执行：

```sh
python scripts/analyze.py beats output/my-song/song.mp3 output/my-song/an
python scripts/analyze.py build output/my-song/an output/my-song/plan.json output/my-song/lyrics.txt --output output/my-song/lyrics.js
python scripts/analyze.py vocals output/my-song/an output/my-song/lyrics.js 25-60 60-95
pnpm render --project output/my-song --out mv.mp4
```

`vocals` 后的时间范围按歌曲实际段落调整。分析图辅助核对人声和字幕位置，仍需结合音频校准。少于 4 秒或缺少节拍变化的输入可手动设置时间轴。

整体调整时间时，修改 `plan.json` 的 `shift` 后重新 build。单位为拍，正数推迟；不要只修改生成的 `lyrics.js` 中的 shift。`--output` 直接写 UTF-8 文件，避免 shell 重定向造成编码差异。

## 预览与导出

打开工程的 `index.html` 可播放、暂停、拖动和按章节跳转。也可在仓库根目录启动本地服务：

```sh
python -m http.server 8000 --bind 127.0.0.1
```

随后访问 `http://127.0.0.1:8000/output/my-song/`。

| 参数 | 用途 |
|---|---|
| `--project 路径` | 指定工程目录 |
| `--start 秒 --end 秒` | 导出片段，默认整片 |
| `--fps 数字` | 默认 30 |
| `--audio 文件名` | 覆盖 config.js 中的音频 |
| `--out 文件名` | 输出文件名，默认 mv.mp4 |
| `--stills 1,3,5` | 导出指定时刻的 PNG |
| `--scale 2` | 截图放大倍数 |
| `--name cover.png` | 单张截图的文件名 |
| `--page cover.html` | 使用封面页面 |

封面示例：

```sh
pnpm render --project output/my-song --page cover.html --stills 0 --scale 2 --name cover.png
```

修改 `config.js` 的 `format` 为 `landscape` 或 `portrait` 切换画幅，导出前检查字幕、人物及长句是否遮挡或超出边界。不同系统字体会产生细微布局差异。

## 独立工程交付

工程需要附上根目录的 `package.json`、`pnpm-lock.yaml`、`LICENSE` 和 `NOTICE.md`。将 `package.json` 的 `render` 脚本改为 `node render.mjs`，移除仓库测试脚本，保留依赖版本。

接收者在工程目录运行 `pnpm install --frozen-lockfile`、`pnpm browser:install` 和 `pnpm render --out mv.mp4` 即可重新导出。不要打包 node_modules、虚拟环境或浏览器缓存。原创示例生成程序已完成这部分配置。
