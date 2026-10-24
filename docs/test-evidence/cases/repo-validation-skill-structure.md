### Case REPO-VALIDATION-SKILL-STRUCTURE-001: 结构校验独立拒绝非法 skill 元数据

Tests:
- `test:2ab24da769692ef1834dcfab09ce76bd9d67f11e35c5ad43290d6d38ec73c1cc`

Tags:
- `repository-tooling`

Contract:
- 结构校验必须继续拒绝 skill 结构错误，不因链接由独立入口处理而放过。

Proves:
- 健康 fixture 单独清空 description 后仅产生预期结构错误，未被配置或链接错误掩盖。
