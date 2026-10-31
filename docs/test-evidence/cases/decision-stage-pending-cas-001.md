### Case DECISION-STAGE-PENDING-CAS-001: Stage 保留并发 pending 内容

Tests:
- `test:79b4d116a0585ce420ed77a7b83864fb43528b4351ea73492d87463e563428ee`

Tags:
- `decision-records`

Contract:
- Stage 的预检与 pending 替换之间若出现并发 pending 文件，锁内 CAS 必须拒绝替换，不能覆盖他人的暂存字节。

Proves:
- 在构造目标后注入并暂存另一份声明其自身纯 ID 的决策，stage 报告冲突，且该暂存文件字节保持不变。
