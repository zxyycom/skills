### Case TASK-GRAPH-ACTIVE-RECOVERY-001: 未到期 lease 不可被恢复替换

Tests:
- `test:34174629b1c6427b37b20fe1b3823d11c0961d657c57cc8b733141e94597f684`

Tags:
- `task-graph`

Contract:
- 显式恢复参数不能绕过仍有效的 lease。

Proves:
- 在 lease 尚未到期时用匹配旧 lease 与当前 revision 发起恢复仍报 LEASE_CONFLICT。
