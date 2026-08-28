### Case INVESTIGATION-RESOURCE-MISSING-001: referenced missing resources are errors and unreferenced visible resources are warnings

Entry:
- `tools/investigation-report/tests/resources.test.ts > referenced missing resources are errors and unreferenced visible resources are warnings`
- `bun test --test-name-pattern="^referenced missing resources are errors and unreferenced visible resources are warnings$" ./tools/investigation-report/tests/run.ts`

Contract:
- 被引用资源缺失是阻断错误，完全未引用的可见资源只产生 warning。

Proves:
- 缺失引用进入 errors，未引用资源进入 warnings。
