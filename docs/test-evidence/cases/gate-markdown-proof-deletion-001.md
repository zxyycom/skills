### Case GATE-MARKDOWN-PROOF-DELETION-001: Markdown 内容证明的删除集合

Tests:
- `test:a642ea32c81afc610acc631103fce892fe82e9835a35a295823a022499ae4cb3`

Tags:
- `repository-tooling`

Contract:
- 原生源集合删除必须使内容证明失效，即使旧路径未保留在 Git 可见域中。

Proves:
- 删除根、额外与 ignored 源后执行 lint，重新通过的输入可以发布证明。
