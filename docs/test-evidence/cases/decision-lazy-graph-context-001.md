### Case DECISION-LAZY-GRAPH-CONTEXT-001: 稳定记录快照首次图需求才构建并复用邻接

Tests:
- `test:92e781204ed8839b72b5c37fa3dcc4db5045b059ea65f5cc30e0480dd6deec81`

Tags:
- `decision-records`

Contract:
- 稳定记录快照只在首次图需求构建一次，同一快照的完整关系校验、trace 与直接关系筛选共用该图。

Proves:
- 无关系条件、缺失 selector 和无目标方向错误均不调用 getRelationGraph；完整校验、trace 与邻接筛选共用相同图引用，结果成员与边证据精确。
- 图取得后禁止读取原记录 relations 与图全量 edges，前驱/后继筛选仍返回准确成员与证据。
