### Case TEST-EVIDENCE-MIGRATE-ESCAPED-SELECTOR-001: 迁移归一化转义 selector 名称

Tests:
- `test:8765dd324af9c53e7247539670512a40fdaf95d29b6de3535980750d10ae5633`

Tags:
- `repository-tooling`

Contract:
- 迁移将旧 selector 中的名称转义归一化后，仍只接受精确匹配的唯一快照实体。

Proves:
- 以空格转义的旧 Bun selector 与快照中的同一测试实体汇合。
