### Case VERSION-CONTROL-PENDING-WRITE-FAILURE-001: pending 写入失败后保留原范围

Tests:
- `test:717e7115e37febc820324b53744558780956c2877d9cc28ab50cc53e6d3e4c8d`

Tags:
- `version-control`

Contract:
- pending 范围写入失败不能留下部分目标；共享层只报告它能证明的替换 event、系统原因、受控范围和进程内 cause，不推断上层事务 outcome。

Proves:
- 注入 `EACCES` 时返回 `pending-replacement-failed`、`access-denied`、受控 replacement operation 和 path scope。
- 净化后的 detail 不泄露绝对路径或 token，范围内容与写入前一致。
