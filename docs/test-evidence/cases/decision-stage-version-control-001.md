### Case DECISION-STAGE-VERSION-CONTROL-001: Stage 在无版本控制时不写入来源

Tests:
- `test:350b342aa15d8cfdef195a6735c97b25651e9cd43c0b368c39a83433273d7135`

Tags:
- `decision-records`

Contract:
- stage 需要受版本控制的 workspace；不可用时不改动决策来源。

Proves:
- 无 Git workspace 返回诊断且正文不变。
