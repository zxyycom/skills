### Case INVESTIGATION-STAGE-RESOURCE-DELETE-001: stage-index reports selection diagnostics deterministically

Entry:
- `tools/investigation-report/tests/staging.test.ts > stage-index reports selection diagnostics deterministically`
- `bun test --test-name-pattern="^stage-index reports selection diagnostics deterministically$" ./tools/investigation-report/tests/run.ts`

Contract:
- 选择性暂存对无效选择稳定返回可操作的 diagnostics。

Proves:
- 空选择返回 error 且 diagnostics 非空。
