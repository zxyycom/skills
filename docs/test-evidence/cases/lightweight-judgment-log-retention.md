### Case LIGHTWEIGHT-JUDGMENT-CLI-024: 调用意图与独立正文留存

Tests:
- `test:70cbed3d7f9754f860c6df9b243825263f7c82d55e76201cd360a11dce5d89bd`

Tags:
- `lightweight-judgment`

Contract:
- 启用日志后必须先提交发送意图，正文开关独立控制留存，最终摘要和输出 ID 对应同一调用。

Proves:
- 四种正文开关组合中，mock fetch 开始时独立数据库连接已能读取 started 记录与所选请求正文；成功后按输出 callId 查到 succeeded、HTTP 状态、模型、问题数与服务 usage。
- 请求字段与实际发送内容一致；响应 BLOB 保留原始空白和字节，关闭对应开关时为 NULL；摘要不含测试凭据，四次调用保留四行，POSIX 数据库权限为 0600。
