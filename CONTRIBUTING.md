# 参与贡献

Node 通过 Volta 管理，使用 pnpm 和现有锁文件；Python 使用虚拟环境。环境安装见[使用指南](references/usage.md)。

## 检查修改

修改引擎、时间轴或导出流程后，在仓库根目录运行：

```sh
python -m unittest discover -s tests -p 'test_*.py'
pnpm test
pnpm test:smoke
```

`python` 指已安装 `requirements.txt` 的虚拟环境。Windows 的集成检查默认使用 `.venv/Scripts/python.exe`，其他环境可通过 `PYTHON` 指定解释器。

集成检查在 `output/qa-*` 中生成原创工程，验证横竖屏播放、暂停、拖动、章节跳转、截图、带音轨的视频导出、完整解码、封面尺寸和 ffmpeg 失败处理。GitHub Actions 在 Windows 和 Linux 上运行这些检查。

修改视觉组件时，还应查看横竖屏关键帧，检查中文、长句、人物遮挡和字幕安全区。仅修改文档时，检查相对链接、命令和 `git diff --check` 即可。

## 提交问题和代码

问题反馈请附操作系统、Node/Python/ffmpeg 版本、执行命令、错误日志和最小复现。优先使用原创示例或可公开授权的短音频，不必上传整首歌曲。

不要提交 node_modules、虚拟环境、缓存、用户歌曲或凭据。新增依赖请说明用途，更新锁文件，并保留上游许可证。引入外部代码、素材或字体时，注明来源和许可。

## 打包发布

```sh
python scripts/package_skill.py
```

生成 `dist/pixel-song-mv-<版本号>.zip`，可作为 GitHub Release 附件。程序从 `package.json` 读取版本号，按允许列表收集源码，不包含现有歌曲成片、输出、依赖和缓存。

发布前确认测试通过、文档链接有效、素材授权已核对，并审阅 ZIP 与 Git 待提交文件。增加公开资源目录时，同步更新 `scripts/package_skill.py` 的允许列表。MIT 许可不涵盖第三方歌曲与歌词。
