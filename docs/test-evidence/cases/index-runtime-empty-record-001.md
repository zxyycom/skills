### Case INDEX-RUNTIME-EMPTY-RECORD-001: 物化空 State 与 Source Revision Record

Tests:
- `test:491bdb264cb2e2257d1fea5ebf42796c78a02e536bd253e3cbe983e9ac7f6ff6`

Tags:
- `index-runtime`

Contract:
- 状态与逐条来源 revision 可以同时为空，metadata revision 仍必须存在并产生合法空索引。

Proves:
- 精确物化 entries={}、sourceRevision={entries:{},metadata:"source:metadata"}，空记录仍保留 metadata revision。
