### Case DECISION-QUERY-INDEX-MEMBERSHIP-001: 查询读取持久快照并提示陈旧且 Check 检测来源漂移

Tests:
- `test:bc657ec07745a8374cfb473daed69a84a0adef7b4245d72eabe77d7e4f28d31d`

Tags:
- `decision-records`

Contract:
- list/trace 读取持久索引快照并在来源漂移时携带 stderr 陈旧警告继续成功，show 读取正文，check 检测来源漂移并失败。

Proves:
- 删除正文后 list/trace 仍从快照返回并输出持久索引陈旧与 sync-index 提示，show 以正文读取失败退出，check 非零。
