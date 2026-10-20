### Case DECISION-REALLOCATION-CANDIDATE-001: 候选重划关系保持前瞻性

Tests:
- `test:39c873e856c2855da6ab1574a75ba1e7b32379efec6a7aa787b28367acded8cc`

Tags:
- `decision-records`

Contract:
- 单个候选可预先声明重划关系，但完整多对多形状只在建立或修订事务及已建立图中校验。

Proves:
- 来源扫描器与领域关系校验器解析内存 Markdown 后，单条重划关系的候选不产生 sourceErrors、仍以 candidate 计数，前序保持 active。
