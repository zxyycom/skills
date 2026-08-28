### Case INVESTIGATION-STAGE-CONFLICT-001: stage-index preserves strict current index definition requirements

Entry:
- `tools/investigation-report/tests/staging.test.ts > stage-index preserves strict current index definition requirements`
- `bun test --test-name-pattern="^stage-index preserves strict current index definition requirements$" ./tools/investigation-report/tests/run.ts`

Contract:
- 选择性暂存要求当前索引定义完整合法。

Proves:
- 不满足定义要求时返回错误。
