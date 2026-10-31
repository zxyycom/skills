### Case DECISION-STATE-SOURCE-PARITY-001: 内存来源按稳定 ID 确定性构造索引

Tests:
- `test:693d3dbf3e495825e84aae6540c2f07627c1d9b7ccf857f4c7c54cd58a8647a4`

Tags:
- `decision-records`

Contract:
- 同一组内存来源无论输入顺序如何，都必须构造相同的 ID 键决策快照。

Proves:
- 正反顺序的两条根目录/归档来源产生深度相等的快照。
