### Case DECISION-DISCARD-RECORDED-FLAG-001: Discard 参数删除已记录决策而不读取 Git HEAD

Tests:
- `test:77e8c3b4a6c3959143b3ce3d725d5d4ce3817de9cac6a2bd90e2ac2ff6f7de49`

Tags:
- `decision-records`

Contract:
- `--delete-recorded-decision` 是删除已记录 Decision ID 的显式机械选择；带该参数时，direct discard 不再读取 Git `HEAD` 重复判定记录状态。

Proves:
- 已提交 candidate 的 Git `HEAD` 引用损坏后，带参数的 discard 仍成功删除目标。
