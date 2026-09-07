### Case DECISION-SPLIT-SINGLE-SUCCESSOR-001: Evolve 拒绝单后继拆分

Tests:
- `test:d50fd07684433fea400810a8f8e43256f8b759b977cbfabba3283ad4784f38f0`

Tags:
- `decision-records`

Contract:
- `拆分` 是至少包含两个显式后继的闭合一对多策略，单后继不能通过来源关系重新挂接粗前序。

Proves:
- 只选择一个带拆分来源关系的候选时，evolve 报告至少需要两个显式 successor。
