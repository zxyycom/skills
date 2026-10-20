### Case DECISION-EVOLVE-GROUPED-SOURCE-SELECTION-001: Evolve 收敛并核对分组 source 与摘要目标

Tests:
- `test:9f49ebdddb1527f9aa4b49c96d3f6c03922ec10c394fbd847380bac8670ff1db`

Tags:
- `decision-records`

Contract:
- 分组 source 必须属于 selected successor，解析后不得重复；每个 relation-summary 都必须绑定该组完整关系中的目标。

Proves:
- 纯 selector 与生命周期准备对非 selected source、未命中摘要、解析后重复 source 及两个别名指向同一直接 predecessor 的关系集合分别给出明确错误，全部不含 changes。
