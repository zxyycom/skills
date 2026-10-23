### Case DECISION-LIFECYCLE-POST-MUTATION-SCAN-001: 生命周期写后索引检查失败不得伪报成功

Tests:
- `test:b60142e8a7ac450754c09996e57f9098488446ecff9714212d0ab1e72d21c758`

Tags:
- `decision-records`

Contract:
- 正式事务索引实际发布后，读回验收失败不回撤已提交来源，不输出成功消息或关系 review。

Proves:
- 索引原子发布后注入该索引的安全 handle 读取故障，archive 返回 transaction-failed / partial-or-unknown 且 stdout 为空；撤销注错后，旧 source 已缺失、archive 新正文和新 index 均保留。
