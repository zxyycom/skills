### Case DECISION-REALLOCATION-PREDECESSOR-MINIMUM-001: Evolve 拒绝单前序重划

Tests:
- `test:3425b1c52ffacd3c566b059046044eec633d088f56734b6ac4f745cefcf44a21`

Tags:
- `decision-records`

Contract:
- `重划` 必须承接至少两个不同的直接前序。

Proves:
- 纯事务准备对两个后继都只指向同一前序的重划返回 error、exitCode=1，诊断前序数量不足，且不产生 changes。
