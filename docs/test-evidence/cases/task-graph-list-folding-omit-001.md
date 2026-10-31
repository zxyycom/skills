### Case TASK-GRAPH-LIST-FOLDING-OMIT-001: 可从全量数据恢复的 blocker 不重复显示

Tests:
- `test:769f3b8286c8255f6aeee6b97a6711ef6633b6b3e1af46edf71f53a51595f002`

Tags:
- `task-graph`

Contract:
- Control、dependency-incomplete 与 child-incomplete 已能从全量节点和关系恢复，不进入 blocked-by 或 mutex token。

Proves:
- control-candidate、control-waiting、control-paused、dependency-incomplete 与 child-incomplete 同时存在时节点仍没有 blocker token。
