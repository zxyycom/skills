### Case DECISION-MERGE-MINIMUM-001: Evolve 拒绝前序不足的纯归并

Tests:
- `test:b35cfc0bb48cea3d5805a0d2a71af7cd52e879b5a10f9e200e0be1041147af81`

Tags:
- `decision-records`

Contract:
- 最终关系全部为 `归并` 时必须至少包含两个不同直接前序，单前序不能伪装成归并。

Proves:
- 纯事务准备对只有一条归并关系的单后继返回 error、exitCode=1，诊断至少需要两个前序，且不产生 changes。
