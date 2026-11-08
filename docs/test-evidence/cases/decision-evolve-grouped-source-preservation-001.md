### Case DECISION-EVOLVE-GROUPED-SOURCE-PRESERVATION-001: 分组关系保留未指定来源

Tests:
- `test:b770d083e5425c18302bee8766c0d49b62f8dfd1affddc705457963dcfa35922`
- `test:bbbef6bec221c129065217e6601a26d96036fadc60e22c685e8ae6c4796d4e9f`

Tags:
- `decision-records`

Contract:
- 分组 replacement 仅作用于指定 source，未分组 source 保留原关系。

Proves:
- 共享计划测试检查已建立来源的旧目标完整替换为新目标，未分组 candidate 的 before 与 after 相等；Decision evolve 测试独立检查两个分组按各自来源写入索引。两项是组合证据，不声称已对同一闭合事件验证三个来源。
