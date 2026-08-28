### Case INVESTIGATION-STAGE-CONFLICT-001: stage-index preserves strict current index definition requirements

Entry:
- `tools/investigation-report/tests/staging.test.ts > stage-index preserves strict current index definition requirements`
- `bun test --test-name-pattern="^stage-index preserves strict current index definition requirements$" ./tools/investigation-report/tests/run.ts`

Contract:
- 选择性暂存要求当前 index 定义完整合法。

Proves:
- 真实 Git fixture 中旧或错误 definition overlay 明确返回诊断，且 cached pending 保持不变。
