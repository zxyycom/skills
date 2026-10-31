### Case INVESTIGATION-EMPTY-INDEX-SYNC-001: sync-index accepts an existing empty index but not a new empty collection

Tests:
- `test:ee7b94be8ad9b11939d45521b7b09e4c66ffebfc678d101dc6953499dcf39516`

Tags:
- `investigation-report`

Contract:
- 已建立集合删除到空索引后可同步；全新空目录不能由 sync-index 初始化为空集合。

Proves:
- 已有空索引同步成功；无索引空目录返回至少一份报告诊断。
