### Case INVESTIGATION-STAGE-OWNER-PENDING-DEPENDENCY-001: 保留未选资源 owner 的 pending 删除

Tests:
- `test:5657f62961e6f35b8785c5106d093bc4368031eb55a361aff30c053591f827d4`

Tags:
- `investigation-report`

Contract:
- 选择资源消费者暂存时，不自动恢复未选 owner 报告的 pending 删除。

Proves:
- 真实 Git fixture 中 owner 正文已 staged 删除但工作区存在；选择 consumer 的 domain 和 all scope 成功后，owner 仍不在 pending 且工作区原字节保持。
