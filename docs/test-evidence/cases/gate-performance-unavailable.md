### Case GATE-PERFORMANCE-UNAVAILABLE-001: 强制预算不把缺失测量补成零

Tests:
- `test:8a91395061ff8354b31297d76d8cf92b9330283e3abf6dd3a268e29596e3c123`

Tags:
- `performance`
- `repository-tooling`

Contract:
- 强制性能预算需要墙钟与至少一个实际执行样本；缺失测量必须标记 unavailable 并阻断，不以零补齐。

Proves:
- 缺失、空及全 null 的 Check 样本均保留零样本数、null 均值/P90 与固定缺失原因；缺失墙钟保持 null 和独立原因，以上情况均失败。
