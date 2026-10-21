### Case GATE-MARKDOWN-PROOF-EMPTY-001: Markdown 内容证明的空源终态

Tests:
- `test:4cd1981ba34cb539a5bf1e4de03a0e6f7f14c21963dc872cd1467eff19aa15e6`

Tags:
- `repository-tooling`

Contract:
- 精确源集合为空时保留原生 N/A 终态，不伪造 passed 以发布首次内容证明。

Proves:
- 首次计划仍要求 lint 实际结算；原生空源结果为 not-applicable，发布拒绝缺少 lint passed 的结果。
