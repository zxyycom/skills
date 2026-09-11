### Case INDEX-RUNTIME-SOURCE-REVISION-INTEGRITY-001: 拒绝非法或不完整的 Source Revision

Tests:
- `test:8e1079e861f18ad9373b92de05d2981143969183bc80dcf3eeae62261550665e`

Tags:
- `index-runtime`

Contract:
- 结构化 source revision 必须与索引 entries 拥有相同 ID 集合，且每个 entry fingerprint 与 metadata fingerprint 都符合领域 schema。

Proves:
- 从有效索引的 source revision 删除 `constructor` 成员后，解析返回 `state-index.source-revision-members-mismatch`。
- 公共 source-revision schema 拒绝 `__proto__` 对应的非字符串 fingerprint。
- 将有效索引的 metadata fingerprint 改为空字符串后，解析返回 `state-index.source-revision-invalid`。
