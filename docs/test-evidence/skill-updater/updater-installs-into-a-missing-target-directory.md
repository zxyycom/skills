### Case SKILL-UPDATER-MISSING-TARGET-001: Updater 可安装到缺失目录
Entry:
- `tools/skill-updater/tests/run.ts > updater installs into a missing target directory`
- `bun test --test-name-pattern="^updater installs into a missing target directory$" ./tools/skill-updater/tests/run.ts`
Contract:
- 不存在的目标目录应被视为合法首次安装目标并由 updater 创建。
Proves:
- missing 状态成功安装完整远端 `SKILL.md`。
