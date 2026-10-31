### Case VERSION-CONTROL-PENDING-KIND-CHANGES-001: 变化报告包含仅文件表示变化

Tests:
- `test:23e303942ac780164fbd9d00d990e450374750bb6f86610033f7ee92739222a3`

Tags:
- `version-control`

Contract:
- changedPendingPaths 同时识别字节和文件表示变化。

Proves:
- 普通与可执行表示双向转换均返回相同字节路径；完全相同的可执行快照返回空变化。
