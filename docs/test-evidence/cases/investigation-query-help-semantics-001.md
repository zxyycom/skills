### Case INVESTIGATION-QUERY-HELP-SEMANTICS-001: list 与 search help 投影报告发现语义

Tests:
- `test:7dd9b05b92d219c06776c9204920f5a1fc99dffd06d51f143b38f0cdd597399f`

Tags:
- `investigation-report`

Contract:
- `list` 与 `search` 的命令级 help 以紧凑 Semantics 与 Examples 投影普通发现所需语义：正式报告与 authoring candidate 边界、关系参数依赖、结果上限、warning 边界与 `show` 后续入口；精确查询规则仍由固定契约承接。

Proves:
- `list` 与 `search` help 均包含 Semantics 与 Examples，说明 candidates 留在索引外、`--related-to` 先解析再由方向与类型限定。
- `list` help 说明陈旧索引仍返回最后发布快照并可用 sync-index 恢复；`search` help 说明 `--limit` 有界且无 offset 分页、截断或降级 warning 下不据以断言无匹配，并指引用 `show <investigation-id>` 读取完整报告。
