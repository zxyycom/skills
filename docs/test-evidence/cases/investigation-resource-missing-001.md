### Case INVESTIGATION-RESOURCE-MISSING-001: referenced missing resources are errors and unreferenced visible resources are warnings

Tests:
- `test:b2b51994d24d9f1db29280c7307b73726d680f30214daa84222af1741382b1bc`

Tags:
- `investigation-report`

Contract:
- 被引用资源缺失是阻断错误，完全未引用的可见资源只产生 warning。

Proves:
- 缺失引用的错误同时包含 `_resources/owner-report/missing.txt` 与 does not exist，未引用资源进入 warnings。
