### Case INVESTIGATION-CLI-PREVIEW-RECOVERY-001: 调查全量预演恢复边界与严格检查分离

Tests:
- `test:7c63ee178f219ff75f11e8616a03221ce11280c727862b1552861b176b4b7062`

Tags:
- `investigation-report`

Contract:
- Investigation 全量 sync preflight 对合法来源采用正式同步的恢复条件，selected 仍要求可信 baseline，check 不放宽。

Proves:
- 缺失、损坏或旧 schema 索引的全量预演成功并声明未发布，索引仍保持原有或缺失状态；check 和 selected preflight 拒绝。
- 正式同步才恢复完整规范字节；current preflight 成功显示 already current，而非待发布。
