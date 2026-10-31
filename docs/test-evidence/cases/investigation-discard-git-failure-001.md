### Case INVESTIGATION-DISCARD-GIT-FAILURE-001: discard fails closed when a Git worktree cannot be inspected

Tests:
- `test:862f98eede967a13f047fa92c9d4d4d56d5cf27a3b07c2e5f6154aa535980cbd`

Tags:
- `investigation-report`

Contract:
- 除明确的非 Git 工作区外，版本控制发现或 HEAD 检查失败必须阻止 discard 写入。

Proves:
- 损坏的 Git worktree 返回 Git/版本控制诊断，报告未被删除。
