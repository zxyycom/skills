### Case INVESTIGATION-STAGE-INPUT-001: stage-index rejects invalid or duplicate Investigation IDs

Entry:
- `tools/investigation-report/tests/staging.test.ts > stage-index rejects invalid or duplicate Investigation IDs`
- `bun test --test-name-pattern="^stage-index rejects invalid or duplicate Investigation IDs$" ./tools/investigation-report/tests/run.ts`

Contract:
- `stage-index` 拒绝无效或重复 Investigation ID。

Proves:
- 重复和含路径分隔符的 ID 返回 report-id 诊断。
