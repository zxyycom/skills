### Case VERSION-CONTROL-FIRST-PARENT-FAILURE-001: 将 first-parent Git 命令故障映射为操作失败

Tests:
- `test:027c0353a4a177f70110e6322081b7a2a664a5a8dd0815181fc4b90025240c75`

Tags:
- `version-control`

Contract:
- first-parent 变化查询依赖的 Git 对象无法读取时必须返回稳定操作失败，不能返回部分或空结果。

Proves:
- 范围内 blob 损坏导致 Git numstat 命令失败时返回带查询上下文的 `operation-failed`。
