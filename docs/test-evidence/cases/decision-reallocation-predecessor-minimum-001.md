### Case DECISION-REALLOCATION-PREDECESSOR-MINIMUM-001: Evolve 拒绝单前序重划

Tests:
- `test:07aa4f92bd745eed48d4df78660a3dfdecdf4de33b1e9bfc229aab040af44c1f`

Tags:
- `decision-records`

Contract:
- `重划` 必须承接至少两个不同的直接前序。

Proves:
- 两个后继都只指向同一个前序时，evolve 报告前序数量不足。
