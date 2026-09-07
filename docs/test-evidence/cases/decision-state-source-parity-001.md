### Case DECISION-STATE-SOURCE-PARITY-001: 内存来源按稳定 ID 确定性构造索引

Tests:
- `test:0a26744beb176049b6a8c1f3f591368a6f42e834fdac799a41cb6bad9ae52f54`

Tags:
- `decision-records`

Contract:
- 同一组内存来源无论输入顺序如何，都必须构造相同的 ID 键决策快照。

Proves:
- 正反顺序的两条根目录/归档来源产生深度相等的快照。
