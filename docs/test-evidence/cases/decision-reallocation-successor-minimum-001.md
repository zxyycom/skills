### Case DECISION-REALLOCATION-SUCCESSOR-MINIMUM-001: Evolve 拒绝单后继重划

Tests:
- `test:e17fdb0bb536425ee1697289ecbd3acb6cee743a88b525d0b1cbe3081ebf7ee8`

Tags:
- `decision-records`

Contract:
- `重划` 是闭合的多前序多后继策略，不能以一个后继建立。

Proves:
- 只选择一个具有两个重划前序的候选时，evolve 报告至少需要两个显式 successor。
