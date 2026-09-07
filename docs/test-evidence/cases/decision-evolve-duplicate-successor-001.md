### Case DECISION-EVOLVE-DUPLICATE-SUCCESSOR-001: Evolve CLI 拒绝重复后继成员

Tests:
- `test:929b6f0fae6718cb54c15f3fcb4c84ddb7808a47f9aa12e858c6a072add85e6a`

Tags:
- `decision-records`

Contract:
- 一次 evolve 的完整 successor 集合中，每个规范决策路径只能出现一次。

Proves:
- 同一路径重复提供两个 `--successor` 时，源码 CLI 入口在参数边界退出 `2` 并报告重复后继路径。
