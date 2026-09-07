### Case INVESTIGATION-RESOURCE-MISSING-001: referenced missing resources are errors and unreferenced visible resources are warnings

Tests:
- `test:3c0cf52aeeaa07025a3629b2d1b7dda52f142835aed19797f1b7eddcb48017a0`

Tags:
- `investigation-report`

Contract:
- 被引用资源缺失是阻断错误，完全未引用的可见资源只产生 warning。

Proves:
- 缺失引用进入 errors，未引用资源进入 warnings。
