### Case CHANGE-PLAN-DRAFT-SELECTION-NO-GIT-001: Draft 筛选不执行无关 Plan 的 Git 查询

Tests:
- `test:75da04b0f84c9c75391ac1f4c555b07d2e631fec56299c9f357757f5fd28e75c`

Tags:
- `change-plan`
- `performance`

Contract:
- list --stage draft 只返回规范 Draft，不需要为筛选排除的 Plan 计算 Git 距离。

Proves:
- Draft 与基线不可用的 Plan 并存时，结果只有完整的 Draft checker entry，真实 Git trace 为空。
