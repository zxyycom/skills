### Case DECISION-LOCAL-MAINTENANCE-ISOLATION-001: 普通维护保留无关来源问题给显式检查

Tests:
- `test:e2bb24356153379338f4e2045b3090a5c20aa3385a1b194e12b4d1df02362a7b`

Tags:
- `decision-records`

Contract:
- 普通维护只核对所选来源和必要闭包，未读无关正式正文继续沿用发布投影；全集健康由显式 check 承担。

Proves:
- 无关 B 正文损坏时 A 可 mark-aligned，索引保留 B 的发布事实且坏正文不被覆盖，显式 check 仍失败。
