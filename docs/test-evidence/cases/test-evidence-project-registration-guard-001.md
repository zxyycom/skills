### Case TEST-EVIDENCE-PROJECT-REGISTRATION-GUARD-001: 项目生产器拒绝不完整或不支持的注册

Tests:
- `test:b96d4ac40d90e5ad7f22d8c823946b03044e244a50384ccdc1baa7fd448c7f08`

Tags:
- `repository-tooling`

Contract:
- 非静态或不支持的注册，以及缺失报告或非零注册，不能声称产生完整快照。

Proves:
- 动态名称、嵌套测试、无报告和顶层抛错均被拒绝。
