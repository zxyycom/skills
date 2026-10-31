### Case INVESTIGATION-STAGE-DELETION-KNOWN-LOCATION-001: 拒绝已知旧位置仍存在的未同步来源

Tests:
- `test:862335610e0e6261efaa5a6eb2751234c6fcc0ff9df8e0272e211f01fe7ab18b`

Tags:
- `investigation-report`

Contract:
- 缩小删除身份发现范围不允许忽略已知受管路径的未同步来源。

Proves:
- W 发布索引已删 ID 但旧路径正文重现时，stage 返回旧位置仍存在诊断，完整 pending entries 不变。
