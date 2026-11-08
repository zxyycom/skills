### Case DECISION-CANDIDATE-RELATION-SELF-001: 候选关系校验拒绝自引用

Tests:
- `test:e220a04ecd94aa66e4c31e6f7aba7845dc7ee281233b8c7ea1ddf793fa23496c`

Tags:
- `decision-records`

Contract:
- 候选不能以自身决策路径作为关系目标。

Proves:
- 原生 parser 对候选自引用返回错误；真实 CLI 的 `check` 与 `show-candidate` 失败。
- 无 selector 的 `candidates` 正常返回空 records 并在 stderr 告警，未把非法候选当作有效结果。
