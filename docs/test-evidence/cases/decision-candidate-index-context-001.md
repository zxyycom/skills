### Case DECISION-CANDIDATE-INDEX-CONTEXT-001: 候选查询区分缺失损坏与来源漂移的索引

Tests:
- `test:4aac2fac7fc8f421805cfa29d69d2c83590808b8055f51351bbf2d1fa5185996`

Tags:
- `decision-records`

Contract:
- 候选查询可在正式索引真正缺失时按安全来源身份发现继续服务，也可在合法索引对应的正式来源正文漂移时读取候选；已有损坏索引必须失败并要求显式恢复，不能退回来源 fallback。

Proves:
- 同一候选在 missing 与 stale 两种索引场景下，candidates 和 show-candidate 均零退出并返回该候选；invalid JSON 场景下两个查询均退出 1，并在 stderr 提示 explicitly sync-index。
