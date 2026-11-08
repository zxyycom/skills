### Case DECISION-STATIC-SPLIT-PURITY-001: 拆分后继不得混入其他关系

Tests:
- `test:903d91097b3fae84e188a150e21fc63bdb6f74f1a0f4b8f4aa37d67f22d625fa`

Tags:
- `decision-records`

Contract:
- 拆分后继的关系集只能包含一条拆分边。

Proves:
- 原生 evolve 预检在一个后继同时包含拆分和修订边时给出 invalid split relations，持久索引不变；该节点通过真实事务图检查而非旧内存扫描 API。
