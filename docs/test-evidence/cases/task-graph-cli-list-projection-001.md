### Case TASK-GRAPH-CLI-LIST-PROJECTION-001: Task list JSON 等于程序化完整 projection

Tests:
- `test:2c46dd34f44ae85d085db644b52cdff9df5fc3eeae9fd534b548b8f741cb7592`

Tags:
- `task-graph`

Contract:
- task list --json 的 data 必须逐字段等于同一索引和时刻的 TaskGraphService.listTasks() data，不得加入 renderer layout 字段。

Proves:
- 对包含 parent、dependency、exclusion 和继承 control 的 rich fixture，CLI revision 与完整 data 都和程序化结果直接 deep-equal。
- Deep equality 同时证明 CLI 没有自行增加 renderer layout 字段或删减 service projection。
