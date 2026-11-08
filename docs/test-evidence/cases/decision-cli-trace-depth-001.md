### Case DECISION-CLI-TRACE-DEPTH-001: Trace 深度参数边界

Tests:
- `test:dee8aeef08ca1b02c9863b971bdc4e2e978ab8101954d4c521ded55af21e28e7`

Tags:
- `decision-records`

Contract:
- Trace 接受非负深度及 `all`，并拒绝非法或重复的单值选项和无效记录预算。

Proves:
- 真实 CLI 在合法索引上接受 depth 0 和 all；负数、非法文本、重复 depth 及 max-records 0 退出 2 并返回 invalid-arguments。该节点不以图结果验证深度投影。
