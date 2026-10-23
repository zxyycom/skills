### Case INVESTIGATION-DISCARD-TOMBSTONE-WINDOW-001: discard restores tombstoned resources when a rename-window member appears

Tests:
- `test:e5581d5613c38e52806365b1ef99df8b43385db526d9e21c41774d10924ea2b6`

Tags:
- `investigation-report`

Contract:
- owner 资源目录进入 tombstone 后、索引写入前必须再次安全扫描并与预演资源集合一致；窗口内新增成员不得被递归删除。

Proves:
- 在 tombstone 中注入未预演空目录时事务返回 partial-or-unknown；恢复实际写入的已知报告、资源和原索引，未知目录保留在 tombstone，不移入原 owner 或递归删除。
