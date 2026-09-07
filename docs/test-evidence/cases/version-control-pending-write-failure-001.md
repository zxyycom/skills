### Case VERSION-CONTROL-PENDING-WRITE-FAILURE-001: pending 写入失败后保留原范围

Tests:
- `test:1b517f180af72023da028d956a88602027af475f29141a0262d8b4a949b9a4c6`

Tags:
- `version-control`

Contract:
- pending 范围写入失败不能留下部分目标；共享层只报告它能证明的替换 event、系统原因、受控范围和进程内 cause，不推断上层事务 outcome。

Proves:
- 注入 `EACCES` 时返回 `pending-replacement-failed`、`access-denied`、受控 replacement operation 和 path scope。
- 净化后的 detail 不泄露绝对路径或 token，范围内容与写入前一致。
