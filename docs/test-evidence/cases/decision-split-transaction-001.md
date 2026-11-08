### Case DECISION-SPLIT-TRANSACTION-001: Evolve 闭合拆分并独立对齐后继

Tests:
- `test:cdd381ca2767d63b88354b24db736f19333dfa4793665895f3270f98aa8daf5c`

Tags:
- `decision-records`

Contract:
- Evolve 的闭合拆分建立完整后继集合、归档活动前序，并为后继分别保存 alignment 与拆分关系；预检 review 标识各后继。

Proves:
- 单后继预检失败且旧索引与前序保持；添加第二个后继后，预检 review 包含两个后继 ID，正式执行成功并归档前序。
- 读回索引中两后继均为 active，分别为 unaligned/aligned，且各有一条指向原前序的拆分边；节点不声称 postverify review、相同建立时间或 trace 呈现。
