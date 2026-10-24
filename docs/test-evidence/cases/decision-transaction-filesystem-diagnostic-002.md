### Case DECISION-TRANSACTION-FILESYSTEM-DIAGNOSTIC-002: 事务保留结构化派生索引访问诊断

Tests:
- `test:60bf5a4afaf3962b4fabaebbbb8176d0c85e8288f1e0788e68cc0473800e222a`

Tags:
- `decision-records`

Contract:
- Decision transaction 在写前独立验证索引时遇到文件系统访问拒绝，必须保留 `access-denied` 与受控 detail，并在零写入时声明 `no-change`。

Proves:
- 索引的写前安全读取注入 EACCES 后，事务返回 no-change 和带 access-denied 的 transaction diagnostic。
- detail 净化 password 与绝对路径，且 Markdown 来源恢复原字节。
