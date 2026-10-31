### Case DECISION-EVOLVE-GROUPED-REALLOCATION-001: Evolve 独立保留稀疏重划的完整关系集合

Tests:
- `test:ff2eab9ba6c1a8447cb57c40b7718aa82fd0f688d13597ca0ba50a85cb1c1d41`

Tags:
- `decision-records`

Contract:
- 稀疏重划中的每个 selected successor 可以在同一事务中保存不同的完整关系集合和逐边摘要，仍受完整图验证约束。

Proves:
- 一个后继保留指向两个前序的关系，另一个只保留其中一个；两组摘要独立写入且最终严格检查通过。
