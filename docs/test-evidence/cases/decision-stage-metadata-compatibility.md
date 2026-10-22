### Case DECISION-STAGE-METADATA-COMPATIBILITY-001: 暂存拒绝不兼容集合revision

Tests:
- `test:549e816b970d635859bb890a1a85b6758c1cbf84249a087fb3304b0d06675a6c`

Tags:
- `decision-records`

Contract:
- 三方已存在索引的集合 metadata、sourceRevision.metadata 与 definition 必须兼容，不能局部合并不兼容集合。

Proves:
- 合法 pending JSON 的集合 revision 与工作区不同时，index/all 均报告 metadata 不兼容且 pending tree 不变。
