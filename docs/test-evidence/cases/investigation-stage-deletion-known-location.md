### Case INVESTIGATION-STAGE-DELETION-KNOWN-LOCATION-001: 拒绝已知旧位置仍存在的未同步来源

Tests:
- `test:ba3df23d0584bf7d77cc74d9cc9dc8ba4df75b4983f3f752b586cc325d04394e`

Tags:
- `investigation-report`

Contract:
- 缩小删除身份发现范围不允许忽略已知受管路径的未同步来源。

Proves:
- W 发布索引已删 ID 但旧路径正文重现时，stage 返回旧位置仍存在诊断，完整 pending entries 不变。
