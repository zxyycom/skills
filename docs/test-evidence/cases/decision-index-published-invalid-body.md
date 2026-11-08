### Case DECISION-INDEX-PUBLISHED-INVALID-BODY-001: 元数据查询不以坏当前正文替换发布投影

Tests:
- `test:3793ebbf9de41d2ef23dcbddb7638a31c75bf238b2e7ebe3a6880a42c531218b`

Tags:
- `decision-records`

Contract:
- metadata search 使用发布索引，不以当前正文损坏替换投影。

Proves:
- 真实 CLI 在正文为非法 UTF-8 时仍返回索引中的所选记录；缺索引时报错。
