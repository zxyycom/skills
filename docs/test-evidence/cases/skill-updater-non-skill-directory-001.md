### Case SKILL-UPDATER-NON-SKILL-DIRECTORY-001: Updater 拒绝非空非 skill 目录

Tests:
- `test:744cfc9761d902c7ba6ce9608ffb7132bcd62dbe0ea7dde45386c4b81450bf04`

Tags:
- `skill-updater`

Contract:
- 非空且不含 `SKILL.md` 的目录不得被 updater 接管。

Proves:
- 目标在获取 release 数据前失败，现有文件保持不变。
