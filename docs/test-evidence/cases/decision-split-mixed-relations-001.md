### Case DECISION-SPLIT-MIXED-RELATIONS-001: Evolve 拒绝拆分与非拆分后继混合

Tests:
- `test:43afa4cb559eb7e15b0cb29eb6b9bcea3ebd173781f2fad94fcfddba6dc67415`

Tags:
- `decision-records`

Contract:
- 多后继拆分策略要求每个所选后继都恰好保存一条拆分关系，不能把拆分后继和普通修订后继混入同一事务。

Proves:
- 同时选择一个拆分候选和一个修订候选时，evolve 在写入前报告后继关系分布不满足纯拆分策略。
