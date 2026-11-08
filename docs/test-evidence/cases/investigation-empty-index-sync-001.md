### Case INVESTIGATION-EMPTY-INDEX-SYNC-001: sync-index accepts an existing empty index but not a new empty collection

Tests:
- `test:45888f4359c72798faa9e13af30018a605a7c5c4704e35fb2cb9c42e1fddfa56`

Tags:
- `investigation-report`

Contract:
- 无索引的新空调查目录不能作为已建立集合；已有合法空索引可进行 check 与 sync-index。

Proves:
- 真实 CLI 对无索引空目录的 check 与 sync-index 均返回 empty-collection 且不创建索引。
- 写入规范序列化的合法空索引后，两命令均成功；不外推非规范序列化字节的 current 状态。
