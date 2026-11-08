### Case DECISION-EVOLVE-GROUPED-REALLOCATION-001: 稀疏重划保留各后继边摘要

Tests:
- `test:9bffb128cdc9fc093743a4dac03e6087f745c4c52f29483675891bfb3842e484`

Tags:
- `decision-records`

Contract:
- 同次稀疏重划可以为各后继保存不同关系集合与逐边摘要。

Proves:
- 两个候选分别以自身来源关系提供 2+1 条重划边；实际 evolve 提交后索引逐边保留三条摘要，最终图校验成功。该节点不验证 CLI 分组 replacement 解析。
