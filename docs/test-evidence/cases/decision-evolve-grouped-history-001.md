### Case DECISION-EVOLVE-GROUPED-HISTORY-001: Evolve 为仅由分组引入的前序执行历史门禁

Tests:
- `test:c4e0e73b4560fba0dbc07f6ccb1d5482213d9bfb740a3c58eb11990048b7e354`

Tags:
- `decision-records`

Contract:
- 历史基线探测必须按各 successor 的有效最终关系执行，不能遗漏只由分组 replacement 引入的前序。

Proves:
- 未进入 Git HEAD 的 group-only predecessor 使事务暂停，且没有输出成功 review 或修改后继、前序或索引。
