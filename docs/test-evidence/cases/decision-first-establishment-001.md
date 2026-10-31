### Case DECISION-FIRST-ESTABLISHMENT-001: 首次建立创建根目录 Decision ID 与定义十一索引

Tests:
- `test:0647a9b39a51149b1f547e294d2ea78ac5cad9a94a862283efc1bbb920a885e2`

Tags:
- `decision-records`

Contract:
- 空 workspace 首次建立候选时必须在根目录创建活动 Decision ID，并生成 definition version 11 的 state-only ID 键索引。

Proves:
- 首次建立后记录位于根目录，索引使用当前定义版本、稳定 ID 键及显式 aligned state。
