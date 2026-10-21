### Case GATE-MARKDOWN-PROOF-KIND-001: Markdown 内容证明的类型身份

Tests:
- `test:85eb5a2d779bb3f45f34c39d87ed824524c0b29a3da5325cb8e5404b92030ddc`

Tags:
- `repository-tooling`

Contract:
- 普通 Markdown 文件改成目录时，原生源集合与 kind 身份变化必须使内容证明失效。

Proves:
- ignored 根 Markdown 文件被同名空目录替换后，lint 重新执行。
