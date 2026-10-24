### Case REPO-VALIDATION-SKILL-STRUCTURE-001: 结构校验独立拒绝非法 skill 元数据

Tests:
- `test:2ab24da769692ef1834dcfab09ce76bd9d67f11e35c5ad43290d6d38ec73c1cc`

Tags:
- `repository-tooling`

Contract:
- 结构校验独立验证 skill 元数据，缺失 description 属于结构错误。

Proves:
- 健康 fixture 单独清空 description 后仅产生预期结构错误，未被配置或链接错误掩盖。
