### Case DECISION-CLI-EVOLVE-SUCCESSOR-REQUIRED-001: Evolve 要求至少一个后继参数

Tests:
- `test:296b2fd8a6cec498ac6ade6e160b057db84b6a6a048900afb0e1f31033190283`

Tags:
- `decision-records`

Contract:
- Evolve 必须通过至少一个 `--successor` 明确完整后继集合。

Proves:
- 未提供 successor 的 evolve 调用，即使附带 `--discard`，也退出 2 并报告 required option `--successor`。
