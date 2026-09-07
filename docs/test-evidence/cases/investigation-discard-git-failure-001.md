### Case INVESTIGATION-DISCARD-GIT-FAILURE-001: discard fails closed when a Git worktree cannot be inspected

Tests:
- `test:d7bb319d11be801367465a3df616fdcdeb8ca90e684b473f8eda4659ec86b620`

Tags:
- `investigation-report`

Contract:
- 除明确的非 Git 工作区外，版本控制发现或 HEAD 检查失败必须阻止 discard 写入。

Proves:
- 损坏的 Git worktree 返回 Git/版本控制诊断，报告未被删除。
