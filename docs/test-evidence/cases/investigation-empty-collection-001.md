### Case INVESTIGATION-EMPTY-COLLECTION-001: full validation rejects an empty report collection

Tests:
- `test:f0a944f6d5c8d3e5c9c8e281f14d2f444c37c3bf6132eca031ffc9ecf6b7e169`

Tags:
- `investigation-report`

Contract:
- 没有当前派生索引的新建空报告目录不得被视为已建立集合。

Proves:
- 新建空目录返回 at-least-one-report 诊断。
