### Case VERSION-CONTROL-CONTENT-PAYLOAD-EXCLUSION-001: 未选payload字节验收的明确排除

Tests:
- `test:4e947e9bc40534d307f2a017bb66f2308b88b03498d092a6446dfcde7bf9bb3a`

Tags:
- `version-control`

Contract:
- content-paths不验收未选payload实际字节；完整entries身份不变时，未选实际payload变化本身不构成此策略的漂移。

Proves:
- 改写未选对象但保持OID后，content-paths快照仍相同，且所选目标可成功更新。
