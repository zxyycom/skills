### Case SKILL-UPDATER-EMPTY-TARGET-001: Updater 可安装到空目录
Entry:
- `tools/skill-updater/tests/run.ts > updater installs into an empty target directory`
- `bun test --test-name-pattern="^updater installs into an empty target directory$" ./tools/skill-updater/tests/run.ts`
Contract:
- 显式存在的空目录应被视为合法首次安装目标。
Proves:
- 空目录按 unversioned 状态安装完整远端 skill 包。
