### Case TEST-EVIDENCE-STAGE-MISSING-001: 两份索引都缺失的 Case ID 在写入前失败

Tests:
- `test:e7e84d2636a2ad9742ff612fbf3e712eb8ddd2956926c85f55fb408078c1f583`

Tags:
- `test-evidence`

Contract:
- 不存在于可用 Case 索引的选择 ID 必须在写入前被拒绝。

Proves:
- 缺失 ID 返回 selection-invalid；worktree 与 cached 索引字节均保持不变。
