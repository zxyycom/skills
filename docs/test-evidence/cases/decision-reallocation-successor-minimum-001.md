### Case DECISION-REALLOCATION-SUCCESSOR-MINIMUM-001: Evolve 拒绝单后继重划

Tests:
- `test:c94d742bb6fec5efe2ddf3c12db3cb8782cfcaf1a6cfc33f3710bbeb160294ba`

Tags:
- `decision-records`

Contract:
- `重划` 是闭合的多前序多后继策略，不能以一个后继建立。

Proves:
- 纯事务准备对仅选择一个具有两个重划前序的候选返回 error、exitCode=1，诊断至少需要两个显式 successor，且不产生 changes。
