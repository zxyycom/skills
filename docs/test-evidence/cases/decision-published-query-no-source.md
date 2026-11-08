### Case DECISION-PUBLISHED-QUERY-NO-SOURCE-001: Metadata search 使用发布索引

Tests:
- `test:3793ebbf9de41d2ef23dcbddb7638a31c75bf238b2e7ebe3a6880a42c531218b`

Tags:
- `decision-records`

Contract:
- metadata search 使用发布索引，不要求读取当前 Markdown。

Proves:
- 真实 CLI 对非法 UTF-8 当前正文仍返回索引记录，缺索引时失败。
