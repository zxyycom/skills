### Case INDEX-RUNTIME-SOURCE-REVISION-001: 拒绝同步期间变化的源修订

Tests:
- `test:da27352f37a8ebabb056bb088514a1c7475b2ece0d8ae567d49fd113d94f1337`

Tags:
- `index-runtime`

Contract:
- 物化快照与后续快速读取的 metadata/逐 ID 来源 revision 清单必须完全一致。

Proves:
- 快速 revision 与快照的结构化清单不一致时返回 `state-index.source-changed`，不写入混合来源索引。
