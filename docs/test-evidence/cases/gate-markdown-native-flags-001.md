### Case GATE-MARKDOWN-NATIVE-FLAGS-001: Markdown 原生选择

Tests:
- `test:d09ac5d567b309566b59fb8e7aa32523ef89946f36a84f4c2f0ce718e16750eb`

Tags:
- `repository-tooling`

Contract:
- 增量内容检查直接消费 markdown-content flag，不因无关能力激活，也不把省略结算伪造为通过。

Proves:
- 真实违规 Markdown 在仅有业务代码 flag 时 lint 为 N/A；传入内容能力 flag 时 lint 实际执行并 failed。
