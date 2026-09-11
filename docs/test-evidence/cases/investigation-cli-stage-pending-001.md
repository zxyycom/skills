### Case INVESTIGATION-CLI-STAGE-PENDING-001: CLI stage-index preserves pending transaction facts

Tests:
- `test:a9df74f711e8a443a6a88c3e5d5d1352cee51573c528f72e9b1be2328ae935d7`

Tags:
- `investigation-report`

Contract:
- `stage-index` 的 pending index 失败必须把 runtime 的 cause、scope 和 outcome 作为领域诊断输出。

Proves:
- Git pending index lock 返回退出码 1、stdout 为空，stderr 保留 pending-conflict、busy cause、scope 与 no-change outcome。
