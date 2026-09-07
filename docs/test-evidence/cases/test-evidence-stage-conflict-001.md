### Case TEST-EVIDENCE-STAGE-CONFLICT-001: 同索引既有 Pending 被拒绝并原样保留

Tests:
- `test:8a8c1b1b6e6df7a6da169731c2830eb5ad2d0aadce5cca1331b45dc9562405ee`

Tags:
- `test-evidence`

Contract:
- 目标 Case-only 索引已有待提交内容时，选择性暂存不得覆盖、累加、清除或绕过该内容。

Proves:
- 命令返回 pending-conflict 并逐字保留既有 pending 索引。
