### Case DECISION-EVOLVE-GROUPED-COMPLETE-REPLACEMENT-001: Evolve 拒绝不完整或不纯的分组 replacement

Tests:
- `test:2e00692e83169eeb04b08d6f4b6eeb8b65e1bbbd4fae0d60204cbe9999b1955b`

Tags:
- `decision-records`

Contract:
- 同一 `evolve` 中，分组 replacement 仍须让全部 selected successor 共同形成有效的闭合策略；未分组 source 只能保留其自身完整关系，不能替代遗漏或错误的 replacement。

Proves:
- 缺少一个分组、两个分组使用不同 predecessor、或单一分组混入非拆分关系时，命令以领域诊断失败，不输出 review，且不修改任一候选 Markdown 或索引。
