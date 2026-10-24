### Case CHANGE-PLAN-LIFECYCLE-REFRESH-001: Plan 直接从当前 HEAD 刷新基线

Tests:
- `test:7a47d133a8d2e5b540c798e40c908a5f9c4a5b025f8ecd553721069c4e197c68`

Tags:
- `change-plan`

Contract:
- 对现有 Plan 运行 `plan` 时，当前 HEAD 是新 `baseCommit` 的权威来源，刷新路径直接以它覆盖现有基线。

Proves:
- 旧基线为格式正常但不存在的 40 位 hex 时，Plan 重确认成功；新 baseCommit 精确等于当前 HEAD。
