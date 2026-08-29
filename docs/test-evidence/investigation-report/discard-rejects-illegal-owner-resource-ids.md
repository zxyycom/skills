### Case INVESTIGATION-DISCARD-RESOURCE-ID-001: discard rejects illegal owner resource IDs without deleting the report

Entry:
- `tools/investigation-report/tests/discard.test.ts > discard rejects illegal owner resource IDs without deleting the report`
- `bun test --test-name-pattern="^discard rejects illegal owner resource IDs without deleting the report$" ./tools/investigation-report/tests/run.ts`

Contract:
- 删除前必须拒绝不符合受管资源 ID 规则的 owner 文件路径。

Proves:
- 检测到非法 `%` 路径时无写入，报告保持存在。
