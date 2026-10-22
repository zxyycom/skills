### Case DR-INDEX-PAYLOAD-PHASE-COUNT-001: index每阶段只捕获一次P并保留受锁验收

Tests:
- `test:6dd5e3564df73244e2b09afeeea0ea329fc2e3c2f15173341c8d5029b27efb5b`

Tags:
- `decision-records`

Contract:
- index复用本阶段已捕获P，固定H索引调用内读取一次；独立写前、锁内及写后仍承担各自验收。

Proves:
- Git trace显示changed为5次cat-file batch、unchanged为4次，分别覆盖固定H、准备P、独立P、锁内P和必要写后readback。
