### Case INVESTIGATION-STAGE-PENDING-MOVE-AGAIN-001: 保留失去索引定位的旧 pending 路径

Tests:
- `test:8d3f59924916decc498fb86bd6d6d83e513484b8eddf26ae08ca18e258887392`

Tags:
- `investigation-report`

Contract:
- domain 不扫描未知 pending blob 认领其身份，旧位置只能按可信索引或所选 locator 局部定位。

Proves:
- 同一 ID 依次移动到 middle 与 final；domain 保留没有可信索引定位的 middle pending 路径，final 正常暂存，HEAD 已知旧位置退出。
