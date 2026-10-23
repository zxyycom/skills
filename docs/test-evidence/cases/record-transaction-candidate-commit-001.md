### Case RECORD-TRANSACTION-CANDIDATE-COMMIT-001: 候选保留动作提交点而不制造正式索引

Tests:
- `test:9ac2d39c77e8d2551b0cedd9c5dca6ace5dde2a9c274ae6fabb731e6247bf2e3`
- `test:f25237431295e55fb8f8de1bb8c78c243140f7fa23b0430baf73427fff840d7c`

Tags:
- `decision-records`
- `investigation-report`
- `record-operations`

Contract:
- 候选创建或退出以实际动作提交，资源先于最终来源动作；清理失败与验收失败分开。

Proves:
- 创建清理失败仍保留candidate及原正式index，返回committed-cleanup-pending；带资源候选退出后验收失败不恢复已退出来源或资源。
