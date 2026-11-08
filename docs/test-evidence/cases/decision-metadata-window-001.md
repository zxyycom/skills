### Case DECISION-METADATA-WINDOW-001: 元数据搜索限制返回窗口并保留全量精确匹配

Tests:
- `test:af98f1b451d118d106b5002c86e96299576f1daed9cb2c695437ddb5ff7d2d5e`

Tags:
- `decision-records`

Contract:
- Decision metadata 搜索的返回窗口不截断全量匹配计数，并保留返回记录的字段命中证据。

Proves:
- 两条记录均匹配、limit 为 1 时，原生投影返回 1 条，matched 为精确 2，首条保留 title/purpose 匹配字段，覆盖原因包含 `max-records`。
- 此节点不覆盖 CLI 参数范围、默认窗口或大集合性能。
