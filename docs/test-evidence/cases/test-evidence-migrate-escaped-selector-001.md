### Case TEST-EVIDENCE-MIGRATE-ESCAPED-SELECTOR-001: 迁移归一化转义 selector 名称

Tests:
- `test:cce924fba79a87b8cfcd2151dc5d198393f1670255aae857192759d54c371d89`

Tags:
- `repository-tooling`

Contract:
- 迁移将旧 selector 中的名称转义归一化后，仍只接受精确匹配的唯一快照实体。

Proves:
- 以空格转义的旧 Bun selector 与快照中的同一测试实体汇合。
