### Case INVESTIGATION-TRACE-LIMITS-001: Investigation Trace API 分别诊断范围限制

Tests:
- `test:78899819927e05f6c9e654b52903933475bf3a228afdbf403855f432b371b26c`

Tags:
- `investigation-report`

Contract:
- Investigation Trace API 在读取索引前分别校验 maxDepth 与 maxRecords，并返回与各字段对应的参数诊断。

Proves:
- 非法 maxDepth、非法 maxRecords 及二者同时非法时均返回错误；双重非法请求保留两个独立诊断。
