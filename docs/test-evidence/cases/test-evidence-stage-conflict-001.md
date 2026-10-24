### Case TEST-EVIDENCE-STAGE-CONFLICT-001: 同索引既有 Pending 被拒绝并原样保留

Tests:
- `test:03665cf20e92fb6f3d3046ad07343fc7c5c6ff142491a34b29db0507c1c54f1d`

Tags:
- `test-evidence`

Contract:
- 目标 Case-only 索引已有待提交内容时，选择性暂存不得覆盖、累加、清除或绕过该内容。

Proves:
- 命令返回 pending-conflict 并逐字保留既有 pending 索引。
