### Case TEST-EVIDENCE-STAGE-MISSING-001: 两份索引都缺失的 Case ID 在写入前失败

Tests:
- `test:05afecfd3b3eb8578b346c488252b43085c19c63dd4b287a48e5dc86ab047589`

Tags:
- `test-evidence`

Contract:
- 不存在于可用 Case 索引的选择 ID 必须在写入前被拒绝。

Proves:
- 缺失 ID 返回 selection-invalid；worktree 与 cached 索引字节均保持不变。
