### Case GATE-MARKDOWN-PROOF-KIND-001: Markdown 内容证明的类型身份

Tests:
- `test:48f43b9e7e9d22c18e79a042fae95da8473655fe21867567e4ebf1b46554ae0a`

Tags:
- `repository-tooling`

Contract:
- 普通 Markdown 文件改成目录时，原生源集合与 kind 身份变化必须使内容证明失效。

Proves:
- ignored 根 Markdown 文件被同名空目录替换后，lint 重新执行。
