### Case DECISION-MERGE-MINIMUM-001: Evolve 拒绝前序不足的纯归并

Tests:
- `test:e3f87bc58bf0902d8861941351ca329c9d7cae1f952d029fda0397ecf3c67f78`

Tags:
- `decision-records`

Contract:
- 最终关系全部为 `归并` 时必须至少包含两个不同直接前序，单前序不能伪装成归并。

Proves:
- 只有一条归并关系的单后继 evolve 在写入前失败并报告至少需要两个前序。
