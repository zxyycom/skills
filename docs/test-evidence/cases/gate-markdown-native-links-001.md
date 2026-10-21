### Case GATE-MARKDOWN-NATIVE-LINKS-001: Markdown 链接继续结算

Tests:
- `test:1dd866c1cc7fe20d25027def1b7fc85ddd7476bdaa18356253029095b3c4331d`

Tags:
- `repository-tooling`

Contract:
- Markdown 链接检查不进入 receipt 省略，增量模式每轮仍观察非 Markdown 目标。

Proves:
- 真实链接检查没有 enabledByFlags，零 receipt flags 下先通过，非 Markdown 目标删除后实际失败。
