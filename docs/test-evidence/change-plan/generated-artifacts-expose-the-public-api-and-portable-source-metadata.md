### Case CHANGE-PLAN-GENERATED-ARTIFACTS-001: 生成制品公开 API 与来源信息
Entry:
- `tools/change-plan/tests/generated-artifacts.test.ts > generated artifacts expose the public API and portable source metadata`
- `bun test --test-name-pattern="^generated artifacts expose the public API and portable source metadata$" ./tools/change-plan/tests/run.ts`
Contract:
- Change Plan 分发制品必须公开约定 API，并携带可移植维护来源。
Proves:
- 生成脚本、声明与 source map 包含所需导出和仓库相对元数据。
