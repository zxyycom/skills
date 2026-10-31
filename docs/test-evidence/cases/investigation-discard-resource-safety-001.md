### Case INVESTIGATION-DISCARD-RESOURCE-SAFETY-001: discard rejects unsafe owner resource members without deleting the report

Tests:
- `test:401d7b4472e675004ec7812c21dd51cea543b9d1cde884eb16189ef242653219`

Tags:
- `investigation-report`

Contract:
- 删除前必须拒绝 owner 资源树中的符号链接或其他不安全成员。

Proves:
- 检测到符号链接时无写入，报告保持存在。
