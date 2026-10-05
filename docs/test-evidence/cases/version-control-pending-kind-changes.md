### Case VERSION-CONTROL-PENDING-KIND-CHANGES-001: 变化报告包含仅文件表示变化

Tests:
- `test:f1a55a7f1ae8a6a7cf067e2bffa5d850049a3092d65d41410bf67d630e46f39c`

Tags:
- `version-control`

Contract:
- changedPendingPaths 同时识别字节和文件表示变化。

Proves:
- 普通与可执行表示双向转换均返回相同字节路径；完全相同的可执行快照返回空变化。
