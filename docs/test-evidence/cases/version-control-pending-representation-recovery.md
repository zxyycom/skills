### Case VERSION-CONTROL-PENDING-REPRESENTATION-RECOVERY-001: 读回失败保留原可执行快照

Tests:
- `test:f8f8ccbec6e35cbc2e939bcbc239a9e961833a847748e7ca257cea6f3478bfe2`

Tags:
- `version-control`

Contract:
- 替换失败时保留原 pending 内容与文件表示。

Proves:
- 锁定目标写入后被改为非可执行模式时，读回核对返回 pending-replacement-failed；完整原 index 字节保持不变，原可执行快照仍可读取。
