### Case DECISION-REALLOCATION-PREDECESSOR-MINIMUM-001: Evolve 拒绝单前序重划

Tests:
- `test:07aa4f92bd745eed48d4df78660a3dfdecdf4de33b1e9bfc229aab040af44c1f`

Tags:
- `decision-records`

Contract:
- `重划` 必须承接至少两个不同的直接前序。

Proves:
- 纯事务准备对两个后继都只指向同一前序的重划返回 error、exitCode=1，诊断前序数量不足，且不产生 changes。
