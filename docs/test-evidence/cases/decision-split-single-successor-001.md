### Case DECISION-SPLIT-SINGLE-SUCCESSOR-001: Evolve 拒绝单后继拆分

Tests:
- `test:cdd381ca2767d63b88354b24db736f19333dfa4793665895f3270f98aa8daf5c`

Tags:
- `decision-records`

Contract:
- `拆分` 是至少包含两个显式后继的闭合一对多策略，单后继不能通过来源关系重新挂接粗前序。

Proves:
- 原生事务预检仅选择一个带拆分关系的候选时失败，索引字节不变且原前序仍在；将第二后继加入后事务成功并归档前序。本节点不断言 CLI 退出码或诊断文本。
