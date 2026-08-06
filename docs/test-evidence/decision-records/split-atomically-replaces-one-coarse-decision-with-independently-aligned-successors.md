### Case DECISION-SPLIT-TRANSACTION-001: 拆分原子替换粗决策并独立对齐后继
Entry:
- `tools/decision-records/tests/evolution.test.ts > split atomically replaces one coarse decision with independently aligned successors`
- `bun test --test-name-pattern="^split atomically replaces one coarse decision with independently aligned successors$" ./tools/decision-records/tests/run.ts`
Contract:
- `split` 必须在一次可恢复事务中归档一个活动粗决策，建立至少两个完整后继，并让每条后继保存自己的整条决策对齐状态。
Proves:
- 一个未对齐前序被归档后，已成为当前事实的后继为 `aligned`，仍面向未来的后继为 `unaligned`。
- 两条后继都以 `拆分` 关系指向同一前序，拥有同一次建立时间，并能从前序按后继方向追踪。
- 完整事务结束后严格决策检查通过。
