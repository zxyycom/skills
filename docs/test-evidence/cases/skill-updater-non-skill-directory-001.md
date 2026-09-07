### Case SKILL-UPDATER-NON-SKILL-DIRECTORY-001: Updater 拒绝非空非 skill 目录

Tests:
- `test:dc92ff8f30d97ccfd0847ee7cc09a748f60d13e861d1ca78384cf1ba000d8207`

Tags:
- `skill-updater`

Contract:
- 非空且不含 `SKILL.md` 的目录不得被 updater 接管。

Proves:
- 目标在获取 release 数据前失败，现有文件保持不变。
