### Case DECISION-REALLOCATION-PREDECESSOR-MINIMUM-001: Evolve 拒绝单前序重划

Tests:
- `test:61435821f346b3a5e919c57b5a09ee07b3c940b8933d9012a43ffe500c09c4b0`

Tags:
- `decision-records`

Contract:
- `重划` 必须承接至少两个不同的直接前序。

Proves:
- 两个后继都只指向同一个前序时，evolve 报告前序数量不足。
