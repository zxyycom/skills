### Case INVESTIGATION-DISCARD-RESOURCE-SAFETY-001: discard rejects unsafe owner resource members without deleting the report

Tests:
- `test:b8d1ec9207e71766dbc383bc2913c3f2df97c4a6484c3cd8053cc7e94bf8a371`

Tags:
- `investigation-report`

Contract:
- 删除前必须拒绝 owner 资源树中的符号链接或其他不安全成员。

Proves:
- 检测到符号链接时无写入，报告保持存在。
