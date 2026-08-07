### Case TASK-GRAPH-ATOMIC-CANDIDATE-001: 单次 atomic 已写完整候选再抛错时按成功处理

Entry:
- `tools/task-graph/tests/store.test.ts > single atomic write that installs the complete candidate before throwing succeeds`
- `bun test --test-name-pattern="^single atomic write that installs the complete candidate before throwing succeeds$" ./tools/task-graph/tests/run.ts`

Contract:
- atomic 抛错后的回读若逐字等于 candidateText，事务已明确提交且不得重放。

Proves:
- writer 只调用一次，候选完整落盘后响应丢失仍返回 revision 1 成功。
