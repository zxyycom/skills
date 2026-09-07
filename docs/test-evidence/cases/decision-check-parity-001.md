### Case DECISION-CHECK-PARITY-001: Check 保持源码、bundle 与进程 CLI 一致

Tests:
- `test:a0c119cfe2c02b160752506a517517c7d1f129e2e2d8169de8c68332c67a0e2f`

Tags:
- `decision-records`

Contract:
- 同一 workspace 的源码 API、分发 API 与 Node 进程 CLI 必须保持 check 结果一致。

Proves:
- 比较两个 API 结果并运行分发 CLI。
