### Case GATE-MARKDOWN-PROOF-DELETION-001: Markdown 内容证明的删除集合

Tests:
- `test:28a2bbccf129b1b57a4708ad7b3c2dfa58ec91a54807c3921ba4c75ac2d375ac`

Tags:
- `repository-tooling`

Contract:
- 原生源集合删除必须使内容证明失效，即使旧路径未保留在 Git 可见域中。

Proves:
- 删除根、额外与 ignored 源后执行 lint，重新通过的输入可以发布证明。
