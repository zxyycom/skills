### Case TASK-GRAPH-STAGE-EMPTY-HEAD-001: HEAD 无索引时从空基线暂存新索引

Tests:
- `test:6eca20a8cbb4496ecff30ba24ac0233d5c1483280b1bac639eff52994c568ecb`

Tags:
- `task-graph`

Contract:
- Git HEAD 尚无 task index 时，分段暂存使用当前 Schema 的空索引作为基线，并把选中的工作区 task 合成为新的 pending 文件。

Proves:
- 真实 Git 仓库只有索引外基线文件时，选中首个候选 task 后 pending 新增完整 task index，且没有带入索引外路径。
