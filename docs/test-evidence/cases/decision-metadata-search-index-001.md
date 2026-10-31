### Case DECISION-METADATA-SEARCH-INDEX-001: Metadata search 不读取实体并在索引失败时给出恢复路径

Tests:
- `test:4534cd9e2608f5980183585b21e8970f9f11ba530a1c13451289c102c0858f60`

Tags:
- `decision-records`

Contract:
- `search --in metadata` 只能读取持久 Decision index；索引不可用时不得读取实体或回退，并以可行动的 check/sync-index 诊断失败。

Proves:
- 注入的 Decision Markdown 读取失败不影响 metadata 查询成功。
- 删除持久索引后命令非零退出，报告 metadata index 诊断和 check/sync-index 恢复步骤。
