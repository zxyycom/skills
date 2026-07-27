### Case SKILL-UPDATER-NON-SKILL-DIRECTORY-001: Updater 拒绝非空非 skill 目录
Entry:
- `tools/skill-updater/tests/run.ts > updater rejects a non-skill directory before fetching release data`
- `bun test --test-name-pattern="^updater rejects a non-skill directory before fetching release data$" ./tools/skill-updater/tests/run.ts`
Contract:
- 非空且不含 `SKILL.md` 的目录不得被 updater 接管。
Proves:
- 目标在获取 release 数据前失败，现有文件保持不变。
