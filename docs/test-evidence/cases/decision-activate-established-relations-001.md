### Case DECISION-ACTIVATE-ESTABLISHED-RELATIONS-001: Activate 不修订已建立记录的关系

Tests:
- `test:61a6f7750a0c945a61295a36809a14e89e76ea5704cc36ea2a34eff31def52e1`

Tags:
- `decision-records`

Contract:
- `activate --relation` 与 `activate --clear-relations` 只服务于首次建立候选；已建立记录的关系修订必须通过 evolve 表达。

Proves:
- 对已建立记录提供非空关系覆盖或显式清空都返回关系输入不适用诊断。
- 两种拒绝路径均逐字节保留目标 Markdown 和 decision-index.json。
