### Case TASK-GRAPH-STAGE-WATERMARK-CONFLICT-001: 工作区根水位回退时拒绝暂存

Tests:
- `test:0fbf1620b1fd4f2ace82b5b7ed496efabfa5019903f12a4d661ab836c1a014e8`

Tags:
- `task-graph`

Contract:
- 候选工作区的根级 revision 或 nextTaskId 不得相对 Git HEAD 基线回退；冲突必须在 pending 写入前拒绝。

Proves:
- 候选 revision 小于 HEAD 时返回可重试 `REVISION_CONFLICT`，诊断同时给出基线与工作区 revision，且 pending 保持无变化。
