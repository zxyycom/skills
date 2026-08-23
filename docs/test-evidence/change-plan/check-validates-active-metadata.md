### Case CHANGE-PLAN-CHECK-METADATA-001: 检查只接受规范 Active Metadata
Entry:
- `tools/change-plan/tests/check.test.ts > check validates active metadata`
- `bun test --test-name-pattern="^check validates active metadata$" ./tools/change-plan/tests/run.ts`
Contract:
- Active Change 只通过规范 metadata 恢复 Draft 或 Plan 身份与 Git 基线。
Proves:
- null-base Plan、`implementation`、`shelved` 与含未知字段的 Draft 都得到 `invalid-metadata`，其 stage、metadata 与距离为空。
- 缺失 active metadata 得到缺失文件诊断。
