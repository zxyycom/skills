### Case SKILL-UPDATER-REMOTE-OWNER-001: Updater 拒绝其他 owner 的远端包

Tests:
- `test:e09665c4779c0701afedf543c700104350d147a9e552f1538ddd09b5922e9436`

Tags:
- `skill-updater`

Contract:
- 远端包的 `SKILL.md` owner 必须与 updater 目标一致。

Proves:
- 源码 loadRemoteSkillFiles 拒绝错误 owner 的远端包且不返回可安装文件；不声称本节点运行真实 CLI 并监视目标目录。
