### Case TEST-EVIDENCE-STAGE-MISSING-001: 两份索引都缺失的 Case ID 在写入前失败

Tests:
- `test:9c4492875034b982d07fcdfa406079bf641210800ef67fd567e86167d6f92f69`

Tags:
- `test-evidence`

Contract:
- 不存在于可用 Case 索引的选择 ID 必须在写入前被拒绝。

Proves:
- 缺失 ID 返回 selection-invalid；worktree 与 cached 索引字节均保持不变。
