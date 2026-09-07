### Case DECISION-MERGE-MINIMUM-001: Evolve 拒绝前序不足的纯归并

Tests:
- `test:7db861d7f236f6e4bbc79245c3063249d3dd21923e25d89d589f244884035d9d`

Tags:
- `decision-records`

Contract:
- 最终关系全部为 `归并` 时必须至少包含两个不同直接前序，单前序不能伪装成归并。

Proves:
- 只有一条归并关系的单后继 evolve 在写入前失败并报告至少需要两个前序。
