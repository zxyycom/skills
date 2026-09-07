### Case TASK-GRAPH-LIST-ACTIVE-MUTEX-001: Exclusion-running blocker 折叠为 active mutex token

Tests:
- `test:2a7e0348c7c63f8390a1f903952cb20fbfcfb467cd875af4a31632c4cd481dd2`

Tags:
- `task-graph`

Contract:
- exclusion-running blocker 只派生节点 mutex token；重复 endpoint 去重，并按 task ID 排序。

Proves:
- Running 与 recovery-needed endpoint 输出唯一排序 mutex 列表，摘要只将被阻 task 计数一次。
