### Case INVESTIGATION-RESOURCE-INVALID-OWNER-ANCHOR-001: owner report must exist for a report-owned resource

Tests:
- `test:43fadcebbd6a3054d8b5d63cef8635dc983daff3bdc8a261cbb8cbc775cbc1d9`

Tags:
- `investigation-report`

Contract:
- 资源 ID 声明的 owner report 必须存在。

Proves:
- 资源归属校验器从引用映射识别缺失 owner report，并返回包含资源 ID 与 owner ID 的错误。
