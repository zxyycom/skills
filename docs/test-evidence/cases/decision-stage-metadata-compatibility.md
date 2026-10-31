### Case DECISION-STAGE-METADATA-COMPATIBILITY-001: 暂存拒绝不兼容集合revision

Tests:
- `test:a868d80666de8d87dcc49a8ce889e37b2efda85050e658072810bb6bb464fcc4`

Tags:
- `decision-records`

Contract:
- 三方已存在索引的集合 metadata、sourceRevision.metadata 与 definition 必须兼容，不能局部合并不兼容集合。

Proves:
- 合法 pending JSON 的集合 revision 与工作区不同时，index/all 均报告 metadata 不兼容且 pending tree 不变。
