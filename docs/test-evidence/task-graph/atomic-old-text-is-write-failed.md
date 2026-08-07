### Case TASK-GRAPH-ATOMIC-OLD-001: 单次 atomic 抛错且完整旧原文仍在时返回 WRITE_FAILED

Entry:
- `tools/task-graph/tests/store.test.ts > single atomic write failure with the complete old text returns WRITE_FAILED`
- `bun test --test-name-pattern="^single atomic write failure with the complete old text returns WRITE_FAILED$" ./tools/task-graph/tests/run.ts`

Contract:
- atomic writer 每个候选只调用一次；抛错后完整 previousText 等价于明确未提交。

Proves:
- writer 调用一次并在替换前抛错，返回 `WRITE_FAILED` 且 revision 仍为 0。
