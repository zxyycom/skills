### Case DECISION-QUERY-INDEX-MEMBERSHIP-001: 查询读取持久快照且 Check 检测来源漂移

Tests:
- `test:e0f0dca8a69f6481611e205ed7bbe441b7a9ff35b96696793c33fa2b8873870f`

Tags:
- `decision-records`

Contract:
- list/trace 读取持久索引快照，show 读取正文，严格 check 检测来源漂移。

Proves:
- 删除正文后 list/trace 仍从快照返回，show/check 失败。
