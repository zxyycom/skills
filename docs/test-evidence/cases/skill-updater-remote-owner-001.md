### Case SKILL-UPDATER-REMOTE-OWNER-001: Updater 拒绝其他 owner 的远端包

Tests:
- `test:45287ca166be3532a54c564bd6e52269396202317996226244b36c3687ad6d18`

Tags:
- `skill-updater`

Contract:
- 远端包的 `SKILL.md` owner 必须与 updater 目标一致。

Proves:
- 错误 owner 的 release 包不会写入本地目标。
