### Case VERSION-CONTROL-FIRST-PARENT-FAILURE-001: 将 first-parent Git 命令故障映射为操作失败

Tests:
- `test:d895733a7f1d7868db706a8f47ddbac22c3f2e7c4b5a9931aaacd86240b349f2`

Tags:
- `version-control`

Contract:
- first-parent 变化查询依赖的 Git 对象无法读取时必须返回稳定操作失败，不能返回部分或空结果。

Proves:
- 范围内 blob 损坏导致 Git numstat 命令失败时返回带查询上下文的 `operation-failed`。
