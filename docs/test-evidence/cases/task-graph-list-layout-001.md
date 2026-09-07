### Case TASK-GRAPH-LIST-LAYOUT-001: Track、layer 与 parent path 使用实际 task ID 稳定排序

Tests:
- `test:f74d1d05202750fa59149c4ca0e7c0c946bec195671e8a447f2f01f1bbb72f17`

Tags:
- `task-graph`

Contract:
- Parent 与 effective dependency 决定 track 连通分量，只有 dependency 决定 layer；节点按 layer、parent path 和实际 task ID 稳定排序。

Proves:
- 分支、汇合、跨 parent dependency、多层 parent 和孤立任务形成确定的两个 track。
- 相反输入顺序产生逐字节相同输出，重复 dependency endpoint 被去重且每个 task 只出现一次。
