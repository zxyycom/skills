### Case DECISION-CHECK-PARITY-001: Check 保持源码、bundle 与进程 CLI 一致

Tests:
- `test:94c7e8fe02ba5bc415a54c5d01c68e108a6d02b0fa86da0b321627485c398c63`

Tags:
- `decision-records`

Contract:
- 同一 workspace 的源码 API、分发 API 与 Node 进程 CLI 必须保持 check 结果一致。

Proves:
- 比较两个 API 结果并运行分发 CLI。
