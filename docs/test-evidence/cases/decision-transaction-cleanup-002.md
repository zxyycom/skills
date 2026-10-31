### Case DECISION-TRANSACTION-CLEANUP-002: 预检无写入时锁清理失败仍报告 no-change

Tests:
- `test:781cf476cdee37daee4031e878364ba890a1888e1ce3ad9b07d52bc5ebd0869a`

Tags:
- `decision-records`

Contract:
- Decision transaction 在预检拒绝且 collection lock 随后释放失败时，事务 owner 只能声明 `no-change`，不得因回调已返回错误结果而伪称提交。

Proves:
- 并发来源变更使预检失败后，返回结果保留 transaction failure 和 `decision-records.collection-lock-release-failed`。
- lock cleanup 诊断的 outcome 为 `no-change`，且遗留 lock 可在故障注入撤销后清理。
