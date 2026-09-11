### Case TEST-EVIDENCE-STAGE-CONFLICT-001: 同索引既有 Pending 被拒绝并原样保留

Tests:
- `test:f3b1110c73debadbd2d84ffd038d1ab62f42bde9b514c6257d16d2c87abd0fa5`

Tags:
- `test-evidence`

Contract:
- 目标 Case-only 索引已有待提交内容时，选择性暂存不得覆盖、累加、清除或绕过该内容。

Proves:
- 命令返回 pending-conflict 并逐字保留既有 pending 索引。
