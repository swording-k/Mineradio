# Mac 分发与官网实施计划

目标：在最新上游与现有 Mac 适配基础上，为社区分支提供可下载 DMG 和官网。

1. 将原仓库记为 upstream，自己的 Fork 记为 origin；仅快进同步 main，保留已有分支。
2. 复用 electron-builder 的 build:mac:arm64，验证 codesign、hdiutil、映像内 Applications 链接及应用版本。没有已确认的 Developer ID 与公证身份时标为预览版，不宣称免拦截。
3. website/ 使用静态 HTML/CSS/JS，不引入框架。使用原项目真实启动图并注明来源；暗绿舞台配暖白排版，展示功能、平台状态、下载、安装、GPL 与贡献。
4. 网站主要下载链接直接指向我们 Fork 的实际预览 Release；附对应 tag 源码和 SHA256。iPad/iPhone 只展示规划。
5. 核查源码变更和隐私边界后提交、推送；GitHub Pages 部署 website/，浏览器检查桌面与手机布局、导航和下载链接。
6. 保存构建记录与未通过的运行检查；向用户区分预览 DMG、正式签名/公证、已上线官网。
