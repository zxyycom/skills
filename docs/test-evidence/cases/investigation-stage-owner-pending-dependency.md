### Case INVESTIGATION-STAGE-OWNER-PENDING-DEPENDENCY-001: 保留未选资源 owner 的 pending 删除

Tests:
- `test:3019ecd5a891d5de9a60f16727ccddde09eb20fbe0660cde0f56cd35403397d9`

Tags:
- `investigation-report`

Contract:
- 纯索引 owner 依赖不要求未选 pending 正文存在或可读，也不自动恢复其 staged 删除。

Proves:
- 只选择资源消费者时保留 owner staged 删除且成功；显式同选 owner 后才恢复完整配套正文。
