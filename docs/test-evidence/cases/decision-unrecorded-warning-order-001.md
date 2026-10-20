### Case DECISION-UNRECORDED-WARNING-ORDER-001: Evolve 按 Decision ID 顺序列出尚未进入 Git HEAD 的前序提示

Tests:
- `test:92912db9918abd026b1943aa8e9623f66334547973f784bf274921f4a425ece8`

Tags:
- `decision-records`

Contract:
- `evolve` 对多个尚未进入 Git HEAD 的直接前序暂停时，独立历史确认提示按 Decision ID 稳定排序。

Proves:
- 纯历史确认投影面对 z、a 顺序的输入时，以 a、z 顺序输出 Decision history 诊断 target，全部 outcome 为 no-change。
