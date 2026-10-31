### Case TASK-GRAPH-PROCESS-CLAIM-001: 独立 Node CLI 排斥 claim 只有一个赢家

Tests:
- `test:584dbf495e27725c65128f322b9b7751d3c947912cae3a70daf077366d9beae2`

Tags:
- `task-graph`

Contract:
- 独立进程必须通过同一稳定 native lock 串行化并在最新索引重验 exclusion。

Proves:
- 两个显式 Node 进程同时领取排斥任务时一个成功、一个 `STATE_CONFLICT`，最终 revision 只增加一次。
