### Case DECISION-TRANSACTION-FILESYSTEM-DIAGNOSTIC-002: 事务保留结构化派生索引访问诊断

Tests:
- `test:04a79ea8f42a56988a953067f2ff3b18194353c65e49463005c84d31bd8e062c`

Tags:
- `decision-records`

Contract:
- Decision transaction 在写入 Markdown 后构建派生 index 遇到结构化来源文件系统失败时，必须保留 `access-denied` 与受控 detail，并在恢复完成后只声明 `rolled-back`。

Proves:
- 第三次来源读取注入 EACCES 后，事务返回 rolled-back 和带 access-denied 的 transaction diagnostic。
- detail 净化 password 与绝对路径，且 Markdown 来源恢复原字节。
