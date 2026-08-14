### Case CHANGE-PLAN-CHECK-METADATA-001: 检查区分活动元数据与归档历史
Entry:
- `tools/change-plan/tests/check.test.ts > check validates active metadata and preserves archived history`
- `bun test --test-name-pattern="^check validates active metadata and preserves archived history$" ./tools/change-plan/tests/run.ts`
Contract:
- Active Change 只通过规范 metadata 恢复 Draft/Plan 身份与基线；archived Change 由目录身份成立，不解析 active metadata。
Proves:
- null-base Plan、`implementation`、`shelved` 与含未知字段的 Draft 都得到 `invalid-metadata`，其 stage、metadata 与距离为空。
- 缺失 active metadata 得到缺失文件诊断，而无 metadata 的 archived Change 保持有效。
