### Case DECISION-CLI-PREVIEW-RECOVERY-001: 决策全量预演恢复边界与严格检查分离

Tests:
- `test:6ecf7793f5761f855ee45ce5ebad4a534f2ae43bfee75a794c4bccbcc2391ead`

Tags:
- `decision-records`

Contract:
- Decision 全量 sync preflight 对合法来源采用正式同步的恢复条件，selected 仍要求可信 baseline，check 不放宽。

Proves:
- 缺失、损坏或旧 schema 索引的全量预演成功并声明未发布，索引仍保持原有或缺失状态；check 和 selected preflight 拒绝。
- 正式同步才恢复完整规范字节；current preflight 成功显示 up to date，而非待发布。
