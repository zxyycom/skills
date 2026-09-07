### Case INVESTIGATION-CLI-STAGE-PENDING-001: CLI stage-index preserves pending transaction facts

Tests:
- `test:f2a509b258c69c7905f1b22d24756ba2eb305ad3bef712da01c623636dfe5fb4`

Tags:
- `investigation-report`

Contract:
- `stage-index` 的 pending index 失败必须把 runtime 的 cause、scope 和 outcome 作为领域诊断输出。

Proves:
- Git pending index lock 返回退出码 1、stdout 为空，stderr 保留 pending-conflict、busy cause、scope 与 no-change outcome。
