### Case VERSION-CONTROL-FIRST-PARENT-FAILURE-001: 将 first-parent Git 命令故障映射为操作失败

Tests:
- `test:7a09abf71bec07c762fb75a8d0bed7bcd2fb76d848e1ca51bb7a6024f0b25d01`

Tags:
- `version-control`

Contract:
- first-parent 变化查询依赖的 Git 对象无法读取时必须返回稳定操作失败，不能返回部分或空结果。

Proves:
- 范围内 blob 损坏导致 Git numstat 命令失败时返回带查询上下文的 `operation-failed`。
