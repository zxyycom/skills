### Case DECISION-FILESYSTEM-SCAN-EMPTY-INDEX-001: 索引比较区分缺失与无效

Tests:
- `test:cd9e04ab25050f49eed5b576d4b01827edca775595580068c9ed579d927d3b49`

Tags:
- `decision-records`

Contract:
- 全量索引比较区分索引缺失与索引内容无效。

Proves:
- 共同比较层对缺失索引和坏字节分别返回 Missing 与 Invalid。
