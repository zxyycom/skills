### Case DECISION-METADATA-SEARCH-INDEX-001: Metadata search 不读取实体并在索引失败时给出恢复路径

Tests:
- `test:3793ebbf9de41d2ef23dcbddb7638a31c75bf238b2e7ebe3a6880a42c531218b`

Tags:
- `decision-records`

Contract:
- `search --in metadata` 只能读取持久 Decision index；索引不可用时不得读取实体或回退，并给出可行动的同步恢复诊断。

Proves:
- 真实原生 CLI 在所索引正文为非法 UTF-8 时仍成功 metadata 搜索并返回对应 ID。
- 删除持久索引后命令失败、JSON `ok:false`，输出包含 `sync-index` 恢复提示。
