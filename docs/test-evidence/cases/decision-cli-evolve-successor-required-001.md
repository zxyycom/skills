### Case DECISION-CLI-EVOLVE-SUCCESSOR-REQUIRED-001: Evolve 要求至少一个后继参数

Tests:
- `test:8bff62c4c7300c7b9a9131d6c140fab5cc21bb31de30bfdbea3fb11d079f1faa`

Tags:
- `decision-records`

Contract:
- Evolve 必须通过至少一个 `--successor` 明确完整后继集合。

Proves:
- 未提供 successor 的 evolve 调用，即使附带 `--discard`，也退出 2 并报告 required option `--successor`。
