### Case DECISION-RENAME-RELATIONS-001: Decision rename 改写受管关系目标

Tests:
- `test:6b2a69c1474d0723e268e0c7d3353490c3c8f5594dfde92de79d30a92d5abe1e`

Tags:
- `decision-records`

Contract:
- Decision rename 必须把 candidate 与 established 记录中指向旧 ID 的结构化 relation target 改为新完整 ID。

Proves:
- candidate Markdown relation 保存新 ID。
- 建立索引中的 relation state 保存新 ID，集合检查通过。
