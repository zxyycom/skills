### Case GATE-MARKDOWN-PROOF-MISSINGEXCLUDED-001: Markdown 内容证明的排除路径归属

Tests:
- `test:b222e3a2384febb3ff724611e914b171304a2c9e9290122053bde50e60d7ccf3`

Tags:
- `repository-tooling`

Contract:
- missing 路径归属例外必须遵守原生默认排除，不能把 excluded 旧路径当作已批准 Markdown 源。

Proves:
- build 下 tracked Markdown 删除后仍是未归属路径，不能借 missing 例外闭合输入。
