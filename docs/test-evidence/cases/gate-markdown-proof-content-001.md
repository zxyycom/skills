### Case GATE-MARKDOWN-PROOF-CONTENT-001: Markdown 内容证明的正文变化

Tests:
- `test:9dc50c5f3fb3944c481f07bc8a80d040fdd9ddefaf2c4089a53b333c618bd1a0`

Tags:
- `repository-tooling`

Contract:
- 根目录、额外目录和 ignored Markdown 源的字节都是内容证明输入。

Proves:
- 修改各类源正文后仍为闭合输入，并重新执行 markdown-lint。
