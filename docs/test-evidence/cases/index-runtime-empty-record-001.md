### Case INDEX-RUNTIME-EMPTY-RECORD-001: 物化空 State 与 Source Revision Record

Tests:
- `test:5457ca94334a2af73d67383d8ded4f2aeef1a8be10ed5b68a9b4f963c8b841ab`

Tags:
- `index-runtime`

Contract:
- 状态与逐条来源 revision 可以同时为空，metadata revision 仍必须存在并产生合法空索引。

Proves:
- 空 state record 与空 `sourceRevision.entries` 成功物化为没有持久化条目的索引。
