### Case INVESTIGATION-CLI-STAGE-PENDING-001: CLI stage --scope index preserves pending transaction facts

Tests:
- `test:45522b4aab7a62caee3478dffb81bcc0ae9b92a26925a8f240f174ca8f0d244b`

Tags:
- `investigation-report`

Contract:
- `stage --scope index` 的 pending index 失败必须把 runtime 的 cause、scope 和 outcome 作为领域诊断输出。

Proves:
- Git pending index lock 返回退出码 1、stdout 为空，stderr 保留 pending-conflict、busy cause、scope 与 no-change outcome。
