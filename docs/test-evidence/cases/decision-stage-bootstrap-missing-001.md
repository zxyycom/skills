### Case DECISION-STAGE-BOOTSTRAP-MISSING-001: 无 revision 的 Stage 拒绝不存在 ID

Tests:
- `test:52be62c17ca77ede97918809893f1176cc31176bdc9f14706fd6a88ba9366eb6`

Tags:
- `decision-records`

Contract:
- 没有 revision/baseline 的 bootstrap 不能把不存在的选择 ID 解释为空集合或写入 pending。

Proves:
- 空决策目录中的不存在 ID 失败，暂存区保持为空。
