# Mineradio 2.2.0 · 社区 Mac 预览 1

由 swording-k 维护的社区衍生版，产品名仍为 Mineradio，不代表原作者发布。基于上游最新主线 `d43de56`，复用原作者 `v2.2.0-mac` 发布附件内的 Mac 适配源码；保留原作者、Mac 适配及第三方贡献声明。

## 下载与安装

当前提供 Apple Silicon（M 系列芯片）DMG 与 ZIP，支持 macOS 12 及以上。推荐下载 `Mineradio-2.2.0-mac-arm64.dmg`，打开后将 Mineradio 拖入 Applications。

社区包使用已授权的 Developer ID Application 证书签名并启用 Hardened Runtime；尚未完成 Apple 公证。首次打开可能被 macOS 拦截，因此本版仍标记为预览版。请参考 Apple 的[打开应用说明](https://support.apple.com/zh-cn/102445)，不需要关闭全局安全保护。

## 本次内容

- Mac 原生窗口按钮、菜单、⌘ 快捷键、Dock 恢复与桌面歌词能力，沿用作者 Mac 适配。
- 应用更新和发布目标指向 `swording-k/Mineradio`。
- 新增社区产品网站、安装说明与独立下载入口。
- 提供可复用的本地预览、签名、公证打包脚本。

## 验证与限制

- 209 项测试通过；项目快速检查通过。
- 应用签名完整性、DMG 映像和映像内应用分别校验。
- 上一步实际启动、原生菜单、本地 WAV 导入和音频播放已通过。
- 原生窗口最小化自动化检查超时；后续桌面歌词和重启持久化未取得完整通过结果。在线平台登录及会员播放尚未验收。
- 本次不提供 Intel、iPad 或 iPhone 社区客户端，移动端仍在规划中。

## 源码和许可

本 Release 的 tag 及 `Mineradio-2.2.0-community.1-source.zip` 包含实际 Mac 改动、构建脚本、锁文件、GPL-3.0-only 许可证和第三方声明，**不是仅指向原版基础源码的标签**。可按 `docs/MACOS.md` 从源码重建。

原项目：https://github.com/XxHuberrr/Mineradio-paused

社区仓库：https://github.com/swording-k/Mineradio
