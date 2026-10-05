### Case VERSION-CONTROL-PENDING-REPRESENTATION-RECOVERY-001: 读回失败保留原可执行快照

Tests:
- `test:fc76c5e7c49e90be580a77d4b535d374d496c9542086836b85e3fd501dbc8223`

Tags:
- `version-control`

Contract:
- 替换失败时保留原 pending 内容与文件表示。

Proves:
- 锁定目标写入后被改为非可执行模式时，读回核对返回 pending-replacement-failed；完整原 index 字节保持不变，原可执行快照仍可读取。
