### Case DECISION-EVOLVE-GROUPED-SOURCE-SELECTION-001: Evolve 收敛并核对分组 source 与摘要目标

Tests:
- `test:9f49ebdddb1527f9aa4b49c96d3f6c03922ec10c394fbd847380bac8670ff1db`

Tags:
- `decision-records`

Contract:
- 分组 source 必须属于 selected successor，解析后不得重复；每个 relation-summary 都必须绑定该组完整关系中的目标。

Proves:
- 非 selected source、未命中摘要和解析后重复 source 都在领域预演阶段以可行动诊断失败，退出状态为 1，不输出 review，也不修改候选 Markdown 或索引。
