### Case DECISION-LAZY-GRAPH-CONTEXT-001: 稳定记录快照首次图需求才构建并复用邻接

Tests:
- `test:b5eed17864037f58f913899c3b2cd0d4b3a1d5c50e7044de366870d85ac895c8`

Tags:
- `decision-records`

Contract:
- 稳定记录快照只在首次图需求构建一次，同一快照的完整关系校验、trace 与直接关系筛选共用该图。

Proves:
- 无关系条件、缺失 selector 和无目标方向错误均不构图；随后完整校验、trace 与双向邻接筛选合计构图一次并保留同一图引用。
- 禁止重新读取原记录 relations 与图全量 edges 后，前驱和后继筛选仍返回准确成员与边证据。
