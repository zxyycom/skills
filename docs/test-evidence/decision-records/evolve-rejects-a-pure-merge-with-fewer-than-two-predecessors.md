### Case DECISION-MERGE-MINIMUM-001: Evolve 拒绝前序不足的纯归并
Entry:
- `tools/decision-records/tests/evolution.test.ts > evolve rejects a pure merge with fewer than two predecessors`
- `bun test --test-name-pattern="^evolve rejects a pure merge with fewer than two predecessors$" ./tools/decision-records/tests/run.ts`
Contract:
- 最终关系全部为 `归并` 时必须至少包含两个不同直接前序，单前序不能伪装成归并。
Proves:
- 只有一条归并关系的单后继 evolve 在写入前失败并报告至少需要两个前序。
