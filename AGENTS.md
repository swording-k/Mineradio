# Mineradio repository rules

- 默认用简体中文说明结论，保留英文代码标识。
- 先阅读 `docs/DEVELOPMENT.md` 和 `docs/RELEASE_STATUS.md`。GitHub Issue / PR
  保存问题与验收记录；Release 及对应 tag 保存真实对外版本。
- 一个共享 `main`，按 Issue 建短期分支；不要维护长期 Mac / Windows 分叉。
  平台差异进入能力适配层。共享文件修改必须检查 Windows 与 macOS 的影响。
- 每个独立 bug / 功能关联 Issue，提交须说明目的；PR 记录根因、平台影响、
  已跑检查和未完成验证。未验收问题保持 open，不能随代码合并自动关闭。
- Mac 本地测试、Windows CI、安装包构建和原生交互验证是不同证据，分别报告。
  不把平台模拟、交叉编译、ARM VM 或上游已发布称为 Windows x64 实机通过。
- 用户当前明确暂停新版 Mac 安装包对外更新。`fix/qishui-full-playback` 的
  community.3 是本机候选，公开下载保持 community.2，直到用户完成稳定性验收。
- 官网使用实际录屏；处理账号遮隐、裁切、静音与压缩需记录来源。不要展示虚构
  产品 UI，也不要把开发版演示说成公开包已通过的功能。保留 GPL 和上游署名。
- 不提交用户账号、Cookie、授权音源链接或测试登录数据；不在公开 CI 中接入个人账号。
