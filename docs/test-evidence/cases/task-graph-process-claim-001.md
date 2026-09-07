### Case TASK-GRAPH-PROCESS-CLAIM-001: 独立 Node CLI 排斥 claim 只有一个赢家

Tests:
- `test:23b101003edcf13c4f818e8e0a966a3681197ac80945dfdcf113fa707485ef4d`

Tags:
- `task-graph`

Contract:
- 独立进程必须通过同一稳定 native lock 串行化并在最新索引重验 exclusion。

Proves:
- 两个显式 Node 进程同时领取排斥任务时一个成功、一个 `STATE_CONFLICT`，最终 revision 只增加一次。
