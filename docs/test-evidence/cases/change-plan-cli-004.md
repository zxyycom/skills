### Case CHANGE-PLAN-CLI-004: CLI 完整报告 committed cleanup pending

Tests:
- `test:3354bd1d594cc58d21e8c7d7432e23a3d3c081cc2f5951ee8699841baf97437d`

Tags:
- `change-plan`

Contract:
- `committed-cleanup-pending` 是已提交的恢复状态，text 与 JSON 都必须保留 outcome、source、HEAD recovery revision、member count、精确 tombstone 与 cleanup diagnostic，并以成功退出。

Proves:
- 注入 cleanup 失败后，text 以 0 退出并在 stdout 输出 outcome、HEAD、成员数与 tombstone，在 stderr 输出诊断。
- JSON 以 0 退出并保留 `changed`、`error`、`headCommit`、`memberCount` 与 `tombstoneDirectory`。
