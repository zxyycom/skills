### Case TASK-GRAPH-LIST-ACTIVE-MUTEX-001: Exclusion-running blocker 折叠为 active mutex token

Tests:
- `test:f0b6e79eba134d0be08ede3d5b615a70c79502cfe161e497851ecf9a8e909b30`

Tags:
- `task-graph`

Contract:
- exclusion-running blocker 只派生节点 mutex token；重复 endpoint 去重，并按 task ID 排序。

Proves:
- Running 与 recovery-needed endpoint 输出唯一排序 mutex 列表，摘要只将被阻 task 计数一次。
