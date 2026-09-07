### Case DECISION-UNRECORDED-WARNING-ORDER-001: Evolve 按 Decision ID 顺序列出尚未进入 Git HEAD 的前序提示

Tests:
- `test:789871e8f859ddf79a23903b58aee6a9763a9ba1e264bdc556a03607b03b80ee`

Tags:
- `decision-records`

Contract:
- `evolve` 对多个尚未进入 Git HEAD 的直接前序暂停时，独立历史确认提示按 Decision ID 稳定排序。

Proves:
- 候选关系按 `z`、`a` 提供时，stderr 中 `a` 前序的确认提示先于 `z` 前序的确认提示。
