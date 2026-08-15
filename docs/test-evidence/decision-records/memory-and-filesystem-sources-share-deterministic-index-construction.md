### Case DECISION-STATE-SOURCE-PARITY-001: 内存来源按稳定 ID 确定性构造索引

Entry:
- `tools/decision-records/tests/state-snapshot.test.ts > memory sources share deterministic ID-keyed index construction`
- `bun test --test-name-pattern="^memory\ sources\ share\ deterministic\ ID\-keyed\ index\ construction$" ./tools/decision-records/tests/run.ts`

Contract:
- 同一组内存来源无论输入顺序如何，都必须构造相同的 ID 键决策快照。

Proves:
- 正反顺序的两条根目录/归档来源产生深度相等的快照。
