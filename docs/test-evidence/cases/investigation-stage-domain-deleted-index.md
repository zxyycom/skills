### Case INVESTIGATION-STAGE-DOMAIN-DELETED-INDEX-001: domain 保留 pending 索引删除

Tests:
- `test:f1d0670ad43e94afc6f52d4a93dd35991dd1c47035cc3bf8da0962ae067a83c9`

Tags:
- `investigation-report`

Contract:
- domain 刷新领域文件但不修复或重写 pending 索引，包含缺失状态。

Proves:
- 索引 staged 删除后刷新报告正文成功，pending 仍无索引且正文采用当前版本。
