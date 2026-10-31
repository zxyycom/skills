### Case DECISION-EVOLVE-DUPLICATE-SUCCESSOR-001: Evolve CLI 拒绝重复后继成员

Tests:
- `test:55313386b087603eaf548628548abdc1a5f51c34a7e8c5926f994d0f9a946409`

Tags:
- `decision-records`

Contract:
- 一次 evolve 的完整 successor 集合中，每个规范决策路径只能出现一次。

Proves:
- 同一路径重复提供两个 `--successor` 时，源码 CLI 入口在参数边界退出 `2` 并报告重复后继路径。
