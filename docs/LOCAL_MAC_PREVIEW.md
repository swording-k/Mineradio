# 本地 Mac 预览记录

日期：2026-10-17。

- 主线：`XxHuberrr/Mineradio-paused`，提交 `d43de565acabfdc1a9c9820a27e81a98ccbebcef`。
- Mac 适配：原作者 `v2.2.0-mac` Release 的 `Mineradio-2.2.0-macos-source.zip`，SHA-256 为 `3d72234d7a9edd220923348f752f70f9855aeccf72526bedc0f003240fc44535`。
- 附件基于上游 `328a087a14e79d5267a3de54d29108c34ed6cf60`。本地保留最新主线 README 与原有版权、GPL-3.0 和第三方声明；适配细节见 `MACOS.md`。
- 本地分支：`feat/macos-2.2-preview`。`origin` 指向自己的 `swording-k/Mineradio`，`upstream` 指向原项目。
- 本地运行入口：`./script/build_and_run.sh --verify`；Codex Run 按钮使用同一入口。
- 旧版构建和升级前用户数据备份仅保留在本机，不纳入代码或发布包。
- 2026-10-17：本机预览完成后开始制作 Developer ID 签名 DMG 与社区产品站，详见发布说明。

## 验证

- `npm test`：212/212 通过。
- `npm run check`：全部通过。
- Apple Silicon `.app` 构建成功；构建产物和 `/Applications/Mineradio.app` 均通过 `codesign --verify --deep --strict`。
- 已打开安装后的 2.2.0，实际窗口能进入主页。
- 首次 `check:mac` 已通过真实启动、原生菜单、本地 WAV 导入和音频播放；在原生最小化检查处超时，后续生命周期、桌面歌词和重启持久化未获完整通过结论。
- 在线音乐账号登录与会员播放尚未验收。

## 社区分发记录

本次更新发布目标为自己的 Fork；网站位于 `website/`，GitHub Pages 工作流位于 `.github/workflows/website.yml`。社区包的签名、公证和验收状态见 `RELEASE_NOTES_v2.2.0-community.1.md`。
