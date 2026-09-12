### Case DECISION-SPLIT-TRANSACTION-001: Evolve 闭合拆分并独立对齐后继

Tests:
- `test:bc8e0f9b9bf19c0e25259bab2af03067eb90dc7408e77d29d01926cf8bb41182`

Tags:
- `decision-records`

Contract:
- Evolve 必须在一次闭合事务中归档一个活动粗决策、建立至少两个完整后继，并让每个后继独立保存整条决策的 alignment；committed relationReview 覆盖全部显式后继来源。

Proves:
- committed review 分别列出两个 establish source；粗前序被归档，与拆分无关的活动记录不受候选来源关系影响。
- 两个后继分别成为 aligned 和 unaligned，拥有同一次建立时间，并各自只保存一条指向同一粗前序的拆分关系；从粗前序按 successors 方向能够追踪到两个后继。
