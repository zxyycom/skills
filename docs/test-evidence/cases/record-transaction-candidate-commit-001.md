### Case RECORD-TRANSACTION-CANDIDATE-COMMIT-001: 候选保留动作提交点而不制造正式索引

Tests:
- `test:52e55a24d51558948958730b2c3ca2fcc3b51c125fc05b0dd099cabac7596e1e`

Tags:
- `decision-records`
- `investigation-report`
- `record-operations`

Contract:
- 候选创建或退出以实际动作提交，资源先于最终来源动作；清理失败与验收失败分开。

Proves:
- 创建清理失败仍保留candidate及原正式index，返回committed-cleanup-pending；带资源候选退出后验收失败不恢复已退出来源或资源。
