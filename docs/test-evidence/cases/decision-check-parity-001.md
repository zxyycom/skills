### Case DECISION-CHECK-PARITY-001: Check 保持源码 API、分发 API 与同进程 CLI 一致

Tests:
- `test:67e09302ce21f3dd88fecae17517c019fb2c03b0356453b1854500ce73192e58`

Tags:
- `decision-records`

Contract:
- 同一 workspace 的源码 API、分发 API 与分发同进程 CLI 必须保持 check 结果一致。

Proves:
- 源码与分发 API 的完整验证结果相同；分发同进程 CLI 退出 0、stderr 为空且输出成功摘要，不启动 Node 子进程。
