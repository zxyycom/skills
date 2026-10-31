### Case DECISION-SET-RELATIONS-DOMAIN-GUARDS-001: set-relations 仅维护已建立记录并校验摘要命中

Tests:
- `test:af47daa4e5183d48b604d2522de68a7f934fa789a6e3316583c642c931d9742f`
- `test:f345b2abdc168d42f7797a127bc9fe2feefb010e0dcadf218ea822862734798d`

Tags:
- `decision-records`

Contract:
- `set-relations` 的 source 必须是已建立记录；候选关系继续在候选来源中维护。摘要必须命中该组最终关系集合。

Proves:
- 纯 selector 与生命周期准备拒绝候选 source，返回只允许 established 记录的领域错误且不含 changes。
- 摘要 target 未命中最终完整关系集时，返回 relation-summary 错误且不含 changes。
