### Case DECISION-DISCARD-RECORDED-FLAG-001: Discard 参数删除已记录决策而不读取 Git HEAD

Tests:
- `test:bd6ecd434c2f1c162430ccff1a4749974269dbe6d00eb315bb761650b92219e4`

Tags:
- `decision-records`

Contract:
- `--delete-recorded-decision` 是删除已记录 Decision ID 的显式机械选择；带该参数时，direct discard 不再读取 Git `HEAD` 重复判定记录状态。

Proves:
- 已提交 candidate 的 Git `HEAD` 引用损坏后，带参数的 discard 仍成功删除目标。
