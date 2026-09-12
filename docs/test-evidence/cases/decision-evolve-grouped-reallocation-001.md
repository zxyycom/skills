### Case DECISION-EVOLVE-GROUPED-REALLOCATION-001: Evolve 独立保留稀疏重划的完整关系集合

Tests:
- `test:e58739c63360aabeaa5e0e982f701d92570d9aeceb86add01f2632cb11dd2b25`

Tags:
- `decision-records`

Contract:
- 稀疏重划中的每个 selected successor 可以在同一事务中保存不同的完整关系集合和逐边摘要，仍受完整图验证约束。

Proves:
- 一个后继保留指向两个前序的关系，另一个只保留其中一个；两组摘要独立写入且最终严格检查通过。
