### Case CHANGE-PLAN-GIT-ZERO-001: Git 距离在基线处返回零证据

Tests:
- `test:2450d218abe4d771ced3fa2b2ebfcacd7dee7ada180c601675b64e24bc5f5503`

Tags:
- `change-plan`

Contract:
- 当前 HEAD 等于 Plan 基线时返回完整的零距离 measured evidence。

Proves:
- commitCount 与 changedLines 都为零，baseCommit 与 headCommit 相同。
