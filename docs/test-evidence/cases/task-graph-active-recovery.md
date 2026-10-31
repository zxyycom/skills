### Case TASK-GRAPH-ACTIVE-RECOVERY-001: 未到期 lease 不可被恢复替换

Tests:
- `test:5f6a0e06f6240c6640f033fa4cee0658d1b211a163f071aed5ef638363953663`

Tags:
- `task-graph`

Contract:
- 显式恢复参数不能绕过仍有效的 lease。

Proves:
- 在 lease 尚未到期时用匹配旧 lease 与当前 revision 发起恢复仍报 LEASE_CONFLICT。
