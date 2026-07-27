### Case SKILL-UPDATER-PUBLIC-CONTRACT-001: Updater 配置公开稳定契约
Entry:
- `tools/skill-updater/tests/run.ts > updater configuration exposes the public contract`
- `bun test --test-name-pattern="^updater configuration exposes the public contract$" ./tools/skill-updater/tests/run.ts`
Contract:
- Updater 配置必须公开目标 skill、release manifest 资产名和 CLI 入口。
Proves:
- Skill 名称、manifest 资产和公共执行函数均可发现。
