### Case LIGHTWEIGHT-JUDGMENT-LOG-UPGRADE-ENCODING-001: 请求回填的编码前置

Tests:
- `test:9421968fe852f6799b7af1adae2957a823c74587011e37c5ed0e23fd66fe6250`

Tags:
- `lightweight-judgment`

Contract:
- 基于 TEXT 转 BLOB 的标准迁移 SQL 只在 UTF-8 库中计算请求长度；其他库编码必须改用按 UTF-8 编码原文本的实现，不得误填其存储字节数。

Proves:
- 真实 UTF-16le v1 库包含多字节请求文本时，执行随包 SQL 脚本 报错；按指南回滚后数据库字节保持不变。
