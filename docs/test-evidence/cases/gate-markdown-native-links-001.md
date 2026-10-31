### Case GATE-MARKDOWN-NATIVE-LINKS-001: Markdown 链接继续结算

Tests:
- `test:54d2bd6b248095c10943665368a84116034e8fda9d16a7a6c99dc5bce28ceaad`

Tags:
- `repository-tooling`

Contract:
- Markdown 链接检查不进入 receipt 省略，增量模式每轮仍观察非 Markdown 目标。

Proves:
- 真实链接检查没有 enabledByFlags，零 receipt flags 下先通过，非 Markdown 目标删除后实际失败。
