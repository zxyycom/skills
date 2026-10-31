### Case INVESTIGATION-CLI-STAGE-PENDING-001: CLI stage --scope index preserves pending transaction facts

Tests:
- `test:f9b7e8ed96730e0ea527ad0a8a0efa7ecafacd29fcbecca7e9ff2eed0e00a350`

Tags:
- `investigation-report`

Contract:
- `stage --scope index` 的 pending index 失败必须把 runtime 的 cause、scope 和 outcome 作为领域诊断输出。

Proves:
- Git pending index lock 返回退出码 1、stdout 为空，stderr 保留 pending-conflict、busy cause、scope 与 no-change outcome。
