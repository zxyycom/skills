### Case INVESTIGATION-TRACE-LIMITS-001: Investigation Trace API 分别诊断范围限制

Tests:
- `test:199811a2d31e037897a744918f729e4f10f1a47a6441d64ebc7cea2337a8c135`

Tags:
- `investigation-report`

Contract:
- Investigation Trace API 在读取索引前分别校验 maxDepth 与 maxRecords，并返回与各字段对应的参数诊断。

Proves:
- 非法 maxDepth、非法 maxRecords 及二者同时非法时均返回错误；双重非法请求保留两个独立诊断。
