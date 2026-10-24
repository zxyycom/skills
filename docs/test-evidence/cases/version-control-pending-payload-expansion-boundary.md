### Case VERSION-CONTROL-PENDING-PAYLOAD-EXPANSION-BOUNDARY-001: 同阶段 payload 扩展保留选择与缺失事实

Tests:
- `test:63256c8b83423f896bb9074d0c618fc8a0b6e8369055ea4d4dc5f8dc44778c17`

Tags:
- `version-control`

Contract:
- 扩展比较只允许 content-paths 选集单向扩张，原选择的缺失路径也必须保留；严格相等比较仍要求精确选集。

Proves:
- 同一完整成员身份下索引式小选集扩到更多 payload 成功，反向收缩、丢失先前缺失路径及精确相等比较均失败。
