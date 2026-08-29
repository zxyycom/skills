### Case INVESTIGATION-DISCARD-RESOURCE-SAFETY-001: discard rejects unsafe owner resource members without deleting the report

Entry:
- `tools/investigation-report/tests/discard.test.ts > discard rejects unsafe owner resource members without deleting the report`
- `bun test --test-name-pattern="^discard rejects unsafe owner resource members without deleting the report$" ./tools/investigation-report/tests/run.ts`

Contract:
- 删除前必须拒绝 owner 资源树中的符号链接或其他不安全成员。

Proves:
- 检测到符号链接时无写入，报告保持存在。
