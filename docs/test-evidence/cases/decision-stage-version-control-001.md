### Case DECISION-STAGE-VERSION-CONTROL-001: Stage 在无版本控制时不写入来源

Tests:
- `test:7183019eb9695704863b318a7206f08afc9808f15f28aff420f73dba1b8c31d9`

Tags:
- `decision-records`

Contract:
- stage 需要受版本控制的 workspace；不可用时不改动决策来源。

Proves:
- 无 Git workspace 返回诊断且正文不变。
