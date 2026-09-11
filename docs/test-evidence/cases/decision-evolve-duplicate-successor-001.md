### Case DECISION-EVOLVE-DUPLICATE-SUCCESSOR-001: Evolve CLI 拒绝重复后继成员

Tests:
- `test:2ec5906b7692a7be6c0dec418da67fc863b0a66779cf89f6a2de62e3aa1d0674`

Tags:
- `decision-records`

Contract:
- 一次 evolve 的完整 successor 集合中，每个规范决策路径只能出现一次。

Proves:
- 同一路径重复提供两个 `--successor` 时，源码 CLI 入口在参数边界退出 `2` 并报告重复后继路径。
