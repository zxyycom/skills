### Case DECISION-STAGE-VERSION-CONTROL-001: Stage 在无版本控制时不写入来源

Tests:
- `test:1757d7c422d8c952a34120ca8eddca007a69950234f09bb898781202d7165c8a`

Tags:
- `decision-records`

Contract:
- stage 需要受版本控制的 workspace；不可用时不改动决策来源。

Proves:
- 无 Git workspace 返回诊断且正文不变。
