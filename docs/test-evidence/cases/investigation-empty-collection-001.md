### Case INVESTIGATION-EMPTY-COLLECTION-001: full validation rejects an empty report collection

Tests:
- `test:bcc2e9dc5195ee05f415ca79a69d2784ed51ea234c39b5bce746918397ce8167`

Tags:
- `investigation-report`

Contract:
- 没有当前派生索引的新建空报告目录不得被视为已建立集合。

Proves:
- 新建空目录返回 at-least-one-report 诊断。
