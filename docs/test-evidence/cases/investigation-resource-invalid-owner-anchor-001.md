### Case INVESTIGATION-RESOURCE-INVALID-OWNER-ANCHOR-001: owner report must exist for a report-owned resource

Tests:
- `test:a3c0a77d22dbb1ee18f1a169bc11da84cc8600ee756e148bf4ec1ef80022c173`

Tags:
- `investigation-report`

Contract:
- 资源 ID 声明的 owner report 必须存在。

Proves:
- 资源归属校验器从引用映射识别缺失 owner report，并返回包含资源 ID 与 owner ID 的错误。
