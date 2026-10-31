### Case DECISION-REALLOCATION-SUCCESSOR-MINIMUM-001: Evolve 拒绝单后继重划

Tests:
- `test:75048302dcfa049cb6891c0c6328db49decc4b07114b4e6a75d033cf18d778f8`

Tags:
- `decision-records`

Contract:
- `重划` 是闭合的多前序多后继策略，不能以一个后继建立。

Proves:
- 纯事务准备对仅选择一个具有两个重划前序的候选返回 error、exitCode=1，诊断至少需要两个显式 successor，且不产生 changes。
