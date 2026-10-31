### Case VERSION-CONTROL-PENDING-PAYLOAD-EXPANSION-BOUNDARY-001: 同阶段 payload 扩展保留选择与缺失事实

Tests:
- `test:2f9eb4105def3330cb489f35eedc47aad4beb6e910666255fe05853aa7efd1f4`

Tags:
- `version-control`

Contract:
- 扩展比较只允许 content-paths 选集单向扩张，原选择的缺失路径也必须保留；严格相等比较仍要求精确选集。

Proves:
- 同一完整成员身份下索引式小选集扩到更多 payload 成功，反向收缩、丢失先前缺失路径及精确相等比较均失败。
