### Case INVESTIGATION-STAGE-DELETION-KNOWN-LOCATION-001: 拒绝已知旧位置仍存在的未同步来源

Tests:
- `test:98d11876cfa3800ece4f0efe3ad8b08f856406cc393ba7cb7dacd248341622a7`

Tags:
- `investigation-report`

Contract:
- 缩小删除身份发现范围不允许忽略已知受管路径的未同步来源。

Proves:
- 真实 Git 中 W 发布索引已删除 ID 但 HEAD 所知旧路径正文仍存在，all/domain 均失败，完整 pending 条目及旧文件字节不变；未断言具体诊断文本。
