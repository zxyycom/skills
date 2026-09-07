### Case DECISION-STATIC-MERGE-MINIMUM-001: 严格关系检查拒绝前序不足的纯归并

Tests:
- `test:200be5e5f8144725e030034dc2c913317672baea9285bfad1855ec4e5c0ee211`

Tags:
- `decision-records`

Contract:
- 已建立关系图中的纯归并关系集必须至少包含两个直接前序。

Proves:
- 把既有单前序修订改成单前序归并后，严格检查报告 pure 归并 relation set 数量不足。
