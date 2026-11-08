### Case DECISION-EVOLVE-GROUPED-SPLIT-001: 闭合拆分各后继保留独立摘要

Tests:
- `test:b770d083e5425c18302bee8766c0d49b62f8dfd1affddc705457963dcfa35922`

Tags:
- `decision-records`

Contract:
- 闭合拆分可在一次 evolve 中为各后继分别提供完整关系与摘要。

Proves:
- 原生 evolve 为两个候选分组同一前序的拆分关系；提交后索引中两条边分别保留不同摘要，trace 保留首条摘要。此节点不验证 CLI option 形式或重复移除摘要的 review。
