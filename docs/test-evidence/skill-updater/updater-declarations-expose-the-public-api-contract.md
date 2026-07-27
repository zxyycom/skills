### Case SKILL-UPDATER-DECLARATIONS-001: Updater 声明公开稳定 API 契约
Entry:
- `tools/skill-updater/tests/run.ts > updater declarations expose the public API contract`
- `bun test --test-name-pattern="^updater declarations expose the public API contract$" ./tools/skill-updater/tests/run.ts`
Contract:
- 生成声明必须指向维护源并公开配置字段、目标名称约束和执行入口。
Proves:
- 声明包含 manifest 资产、期望 skill 名称、CLI 函数与配置导出。
