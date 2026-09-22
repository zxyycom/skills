### Case DECISION-QUERY-HELP-SEMANTICS-001: list 与 search help 投影记录发现语义

Tests:
- `test:74dc82fe39b97acc5a37d6fb0576a1534959298755bb8471178ef0ed24ed3344`

Tags:
- `decision-records`

Contract:
- `list` 与 `search` 的命令级 help 以紧凑 Semantics 与 Examples 投影普通发现所需语义：正式记录与 candidate 边界、关系参数依赖、warning 边界与 `show` 后续入口；精确查询规则仍由固定契约承接。

Proves:
- `list` 与 `search` help 均包含 Semantics 与 Examples，说明 candidates 留在索引外、`--related-to` 先解析再由方向与类型限定。
- `list` help 说明陈旧索引仍返回最后发布快照并可用 sync-index 恢复；`search` help 说明截断或降级 warning 下读取已返回 ID 或收紧筛选、不据以断言无匹配，并指引用 `show <decision-id>` 读取完整记录。
