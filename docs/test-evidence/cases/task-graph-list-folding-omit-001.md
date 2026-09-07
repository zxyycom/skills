### Case TASK-GRAPH-LIST-FOLDING-OMIT-001: 可从全量数据恢复的 blocker 不重复显示

Tests:
- `test:4137229cb762b3324d430be1926eaf4ed7027d0d15ef93d03a9c327cc4b5cd82`

Tags:
- `task-graph`

Contract:
- Control、dependency-incomplete 与 child-incomplete 已能从全量节点和关系恢复，不进入 blocked-by 或 mutex token。

Proves:
- control-candidate、control-waiting、control-paused、dependency-incomplete 与 child-incomplete 同时存在时节点仍没有 blocker token。
