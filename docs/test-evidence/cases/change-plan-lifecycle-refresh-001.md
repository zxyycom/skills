### Case CHANGE-PLAN-LIFECYCLE-REFRESH-001: Plan 直接从当前 HEAD 刷新基线

Tests:
- `test:fa0dc819d2734176172465d8ff3b995d7986466494358d71a089d10d39285514`

Tags:
- `change-plan`

Contract:
- 对现有 Plan 运行 `plan` 时，当前 HEAD 是新 `baseCommit` 的权威来源，刷新路径直接以它覆盖现有基线。

Proves:
- 旧基线为格式正常但不存在的 40 位 hex 时，Plan 重确认成功；新 baseCommit 精确等于当前 HEAD。
