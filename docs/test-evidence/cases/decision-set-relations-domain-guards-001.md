### Case DECISION-SET-RELATIONS-DOMAIN-GUARDS-001: set-relations 仅维护已建立记录并校验摘要命中

Tests:
- `test:230b4873cb0bc8aa5d1a72de6f36df0c83c81556c2dc783e7cf914489939b33a`
- `test:3815f05932b9014c49a216b2c0e416e4b8c8a0f7da6590aea49e5569d0a7242b`

Tags:
- `decision-records`

Contract:
- `set-relations` 的 source 必须是已建立记录；候选关系继续在候选来源中维护。摘要必须命中该组最终关系集合。

Proves:
- 纯 selector 与生命周期准备拒绝候选 source，返回只允许 established 记录的领域错误且不含 changes。
- 摘要 target 未命中最终完整关系集时，返回 relation-summary 错误且不含 changes。
