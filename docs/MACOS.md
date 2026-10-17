# macOS 开发与分发

本分支基于 Mineradio 2.2.0，保留 Electron 界面与本地服务，增加 macOS 12 及以上系统的运行和打包支持。Windows 现有构建命令继续可用。

## 开发

在 macOS 上安装 Node.js 24 或更新的兼容 LTS 版本，然后在仓库根目录运行：

```sh
npm ci
npm start
```

Electron 首次运行会下载对应架构的官方运行时，需要可以连接 GitHub。Node.js 与 Electron 版本应满足 package-lock.json 的要求。

## 构建本地预览版

```sh
npm test
npm run check           # 静态与运行逻辑检查
npm run check:mac       # 需要已登录的 macOS 图形桌面，会启动隔离测试实例
npm run build:mac:arm64  # Apple Silicon
npm run build:mac:x64    # Intel
npm run build:mac        # 同时生成两种架构
npm run build:mac:dir    # 仅生成当前架构 .app
```

产物位于 `dist/`，文件名为 `Mineradio-2.2.0-mac-arm64.dmg`、`Mineradio-2.2.0-mac-x64.dmg` 及对应 ZIP。DMG 中将应用拖到 Applications 即可安装。应用仍使用 `com.mineradio.desktop` 标识。

`check:mac` 使用临时用户目录与静音 WAV，验证真实主入口、本地文件导入播放、窗口驻留和恢复、桌面歌词锁定，以及重启后曲库/LRC/媒体范围读取。不会读取正常 Mineradio 的账号和曲库，完成后清理临时用户目录。

以上预览命令显式使用 ad-hoc 签名并关闭 hardened runtime 和公证，仅用于本地试用和测试。没有 Apple 开发者签名或公证的下载件可能被 Gatekeeper 拦截。确认来源后可按 macOS「系统设置 → 隐私与安全性」中的提示处理；不要关闭全局系统保护。

## 正式签名

正式分发需要开发者自己的 Developer ID Application 证书、Apple Developer 团队，以及公证凭据。这些不应写入仓库。

按 electron-builder 的约定配置 `CSC_LINK` / `CSC_KEY_PASSWORD`（或钥匙串证书和 `CSC_NAME`），以及 `APPLE_ID`、`APPLE_APP_SPECIFIC_PASSWORD`、`APPLE_TEAM_ID` 等公证凭据，然后运行：

```sh
npm run build:mac:release
```

此命令强制有效代码签名、开启 hardened runtime 和公证，缺少凭据会失败。它不发布 GitHub Release。正式包还应执行 `codesign --verify --deep --strict`、`spctl --assess --type execute` 和 `xcrun stapler validate`，并在没有开发环境的 Mac 上验证安装。

参考：[Electron 签名指南](https://www.electronjs.org/docs/latest/tutorial/code-signing)、[electron-builder macOS 配置](https://www.electron.build/mac/)。

## Mac 行为与平台差异

- 红色关闭按钮或 ⌘W 隐藏主窗口并保留播放；点击 Dock 图标或「显示 → 显示 Mineradio」恢复。⌘Q 完整退出。
- ⌘H 隐藏、⌘M 最小化；编辑菜单提供复制、粘贴、撤销和全选。可在应用原来的快捷键设置中自定义播放操作。
- Windows WorkerW 桌面模式、Wallpaper Engine 原生壁纸和全局鼠标中键钩子不在 macOS 启用。本地 MP4 背景与普通沉浸式播放仍可用。
- 桌面歌词保留；锁定后的鼠标穿透可通过 Mac 菜单解锁，不要求鼠标中键。
- 只有用户主动启用手势控制才申请摄像头权限；识别在本机执行。首次拒绝后可到系统隐私设置修改授权。
- 用户数据保存在 `~/Library/Application Support/Mineradio`，沿用上游存储格式。此移植没有将上游账号文件改为 Keychain 存储。

## 更新

继续采用系统浏览器手动下载。Mac 只展示匹配当前 CPU 架构的 DMG 或 Mac ZIP（也接受明确标记的 universal 包），不会展示 Windows 网盘安装包入口。没有兼容附件时明确提示并只提供 Release 页面。包的发布命名须保留 `mac` 与 `arm64` / `x64`，例如本分支生成的文件名。

`MINERADIO_UPDATE_MANIFEST` 可使用本地 JSON 模拟新版本。Windows 仍使用上游网盘入口，不改变原有分发方式。

## GitHub Actions

`.github/workflows/build-macos.yml` 提供手动触发的双架构预览构建，先运行测试，再上传 DMG、ZIP 与 SHA256 清单作为构建附件；不会自动发布 Release，也不需要提交签名证书。

## 社区分支分发

产品名仍为 Mineradio，本分支由 swording-k 维护。应用更新与发布配置指向 `swording-k/Mineradio`。

- 临时签名预览：`./script/package_mac.sh preview`。
- Developer ID 签名包：设置已授权的 `CSC_NAME` 后运行 `./script/package_mac.sh signed`。
- 已有钥匙串公证 profile：同时设置 `CSC_NAME` 与 `APPLE_KEYCHAIN_PROFILE` 后运行 `./script/package_mac.sh notarized`。不得将密码、密钥或公证凭据写入仓库。
- 社区下载与官网在自己的 Release 和 GitHub Pages 提供。DMG、ZIP、SHA256 与对应 tag 源码应一并保留，签名、公证与运行验收分别标明。

Mac 签名配置跳过单独签名语言包、图片、字体、WASM 和 V8 快照等非 Mach-O 数据文件；这些文件仍被 Framework 与应用的资源封印覆盖。可执行程序、Framework 与原生动态库仍完整签名并通过严格校验。

签名钩子 `build/sign-macos.cjs` 复用 `@electron/osx-sign`，按 Mach-O 文件头识别原生代码而非按文件后缀猜测，并去除 Framework 符号链接的重复签名。根应用和嵌套应用/Framework 仍交给原签名工具处理。
