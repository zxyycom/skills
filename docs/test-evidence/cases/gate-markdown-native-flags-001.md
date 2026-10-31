### Case GATE-MARKDOWN-NATIVE-FLAGS-001: Markdown 原生选择

Tests:
- `test:53ca8b3126597d0626f0b07e52a991785b4fd02f20ed13e6744ab73580562bb5`

Tags:
- `repository-tooling`

Contract:
- 增量内容检查直接消费 markdown-content flag，不因无关能力激活，也不把省略结算伪造为通过。

Proves:
- 真实违规 Markdown 在仅有业务代码 flag 时 lint 为 N/A；传入内容能力 flag 时 lint 实际执行并 failed。
