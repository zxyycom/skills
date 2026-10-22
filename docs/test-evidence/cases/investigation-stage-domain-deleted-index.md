### Case INVESTIGATION-STAGE-DOMAIN-DELETED-INDEX-001: domain 保留 pending 索引删除

Tests:
- `test:0a26b18334515af1ef08b8f15087406eaff66d96f264e8018ccd928de1ea869b`

Tags:
- `investigation-report`

Contract:
- domain 刷新领域文件但不修复或重写 pending 索引，包含缺失状态。

Proves:
- 索引 staged 删除后刷新报告正文成功，pending 仍无索引且正文采用当前版本。
