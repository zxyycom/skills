### Case DECISION-EVOLVE-DISCARD-SPLIT-CLOSURE-001: 删除后继后保留最终拆分闭合

Tests:
- `test:c4f68b6f910843204ea7ed757acb56c82e9282aac5777faf3e8824884a418f21`

Tags:
- `decision-records`

Contract:
- evolve 与 discard 应在同一最终图校验；删除拆分后继后剩余直接后继仍须形成完整事件。

Proves:
- 先建立三个拆分后继，再选择其余两个并删除第三个；真实事务成功删除第三个来源与索引项，其余两条边保留且最终图验证成功。此节点不包含同时建立替代候选的场景。
