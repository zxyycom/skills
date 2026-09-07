### Case DECISION-STAGE-BOOTSTRAP-MISSING-001: 无 revision 的 Stage 拒绝不存在 ID

Tests:
- `test:3709e5c88410be83c1d6047eb344b1d506824d2e25f9746b4cb2f97539793cd8`

Tags:
- `decision-records`

Contract:
- 没有 revision/baseline 的 bootstrap 不能把不存在的选择 ID 解释为空集合或写入 pending。

Proves:
- 空决策目录中的不存在 ID 失败，暂存区保持为空。
