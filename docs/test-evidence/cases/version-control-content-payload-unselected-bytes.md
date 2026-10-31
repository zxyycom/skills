### Case VERSION-CONTROL-CONTENT-PAYLOAD-EXCLUSION-001: 未选payload字节验收的明确排除

Tests:
- `test:93627950925156ce60bf0563a2a76e1e4cb477369d3defa9ec13a5e918196caa`

Tags:
- `version-control`

Contract:
- content-paths不验收未选payload实际字节；完整entries身份不变时，未选实际payload变化本身不构成此策略的漂移。

Proves:
- 改写未选对象但保持OID后，content-paths快照仍相同，且所选目标可成功更新。
