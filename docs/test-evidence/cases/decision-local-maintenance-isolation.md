### Case DECISION-LOCAL-MAINTENANCE-ISOLATION-001: 普通维护保留无关来源问题给显式检查

Tests:
- `test:f4411d42efb04e5374496684d2b0926cf54fc21acbc0d78132f6fa57a463675d`

Tags:
- `decision-records`

Contract:
- 普通维护只核对所选来源和必要闭包，未读无关正式正文继续沿用发布投影；全集健康由显式 check 承担。

Proves:
- 无关 B 正文损坏时 A 可 mark-aligned，索引保留 B 的发布事实且坏正文不被覆盖，显式 check 仍失败。
