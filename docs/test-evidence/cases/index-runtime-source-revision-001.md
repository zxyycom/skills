### Case INDEX-RUNTIME-SOURCE-REVISION-001: 拒绝同步期间变化的源修订

Tests:
- `test:f9827a6da32aba9bd5b2aee70a1f0998fd6d6d83de9c5749f1cdc172bb606fa2`

Tags:
- `index-runtime`

Contract:
- 物化快照与后续快速读取的 metadata/逐 ID 来源 revision 清单必须完全一致。

Proves:
- 快速 revision 与快照的结构化清单不一致时返回 `state-index.source-changed`，目标索引及父目录均未创建，受控临时根保持为空。
