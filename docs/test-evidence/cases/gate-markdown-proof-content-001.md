### Case GATE-MARKDOWN-PROOF-CONTENT-001: Markdown 内容证明的正文变化

Tests:
- `test:2f25369fa5fa8ac320d0f357727da154187d987e1bf7bde235df63501b9dee78`

Tags:
- `repository-tooling`

Contract:
- 根目录、额外目录和 ignored Markdown 源的字节都是内容证明输入。

Proves:
- 修改各类源正文后仍为闭合输入，并重新执行 markdown-lint。
