### Case DECISION-UNRECORDED-WARNING-ORDER-001: Evolve 按 Decision ID 顺序列出尚未进入 Git HEAD 的前序提示

Tests:
- `test:92912db9918abd026b1943aa8e9623f66334547973f784bf274921f4a425ece8`

Tags:
- `decision-records`

Contract:
- `evolve` 对多个尚未进入 Git HEAD 的直接前序暂停时，独立历史确认提示按 Decision ID 稳定排序。

Proves:
- 候选关系按 `z`、`a` 提供时，stderr 中 `a` 前序的确认提示先于 `z` 前序的确认提示。
