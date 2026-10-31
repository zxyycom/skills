### Case TEST-EVIDENCE-MIGRATE-ESCAPED-SELECTOR-001: 迁移归一化转义 selector 名称

Tests:
- `test:1ebc1290dc74d379d6bc108ccf63177671ce21b5dc118d52033c7e3299b98e6e`

Tags:
- `repository-tooling`

Contract:
- 迁移将旧 selector 中的名称转义归一化后，仍只接受精确匹配的唯一快照实体。

Proves:
- 以空格转义的旧 Bun selector 与快照中的同一测试实体汇合。
