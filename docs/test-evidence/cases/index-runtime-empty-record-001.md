### Case INDEX-RUNTIME-EMPTY-RECORD-001: 物化空 State 与 Source Revision Record

Tests:
- `test:4693f5927e897f8d82f159a7ecc095d936bb69bc708731527c34556f7ab69e4a`

Tags:
- `index-runtime`

Contract:
- 状态与逐条来源 revision 可以同时为空，metadata revision 仍必须存在并产生合法空索引。

Proves:
- 空 state record 与空 `sourceRevision.entries` 成功物化为没有持久化条目的索引。
