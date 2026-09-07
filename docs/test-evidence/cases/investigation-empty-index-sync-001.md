### Case INVESTIGATION-EMPTY-INDEX-SYNC-001: sync-index accepts an existing empty index but not a new empty collection

Tests:
- `test:3f2a2bb71bdf8cc12f9eec4f879ff3fddc7b8ef03b4cedf803a9c44e81acbc40`

Tags:
- `investigation-report`

Contract:
- 已建立集合删除到空索引后可同步；全新空目录不能由 sync-index 初始化为空集合。

Proves:
- 已有空索引同步成功；无索引空目录返回至少一份报告诊断。
