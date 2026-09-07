### Case INVESTIGATION-DISCARD-TOMBSTONE-WINDOW-001: discard restores tombstoned resources when a rename-window member appears

Tests:
- `test:4d18983df7a56b7399f1f1b3adb6d2238deb5badb22e92f533c1f512963fc6c0`

Tags:
- `investigation-report`

Contract:
- owner 资源目录进入 tombstone 后、索引写入前必须再次安全扫描并与预演资源集合一致；窗口内新增成员不得被递归删除。

Proves:
- 在 rename 后注入未预演的空目录时事务失败并恢复报告、owner 资源和原索引，注入成员也没有被删除。
