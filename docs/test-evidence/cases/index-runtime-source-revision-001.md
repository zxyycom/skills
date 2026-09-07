### Case INDEX-RUNTIME-SOURCE-REVISION-001: 拒绝同步期间变化的源修订

Tests:
- `test:8656e70c496831229863c7e6f9c068f5ed1d0022f4bff4271c9423137f0a6c51`

Tags:
- `index-runtime`

Contract:
- 物化快照与后续快速读取的 metadata/逐 ID 来源 revision 清单必须完全一致。

Proves:
- 快速 revision 与快照的结构化清单不一致时返回 `state-index.source-changed`，不写入混合来源索引。
