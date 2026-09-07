### Case INVESTIGATION-SEARCH-METADATA-001: search 仅读取已发布 metadata 并报告命中证据

Tests:
- `test:c6f0a13ec1db0bc7d15236c8abf4b33f7d953be33c540abcab9cf43b5752a7fa`

Tags:
- `investigation-report`

Contract:
- `search --in metadata` 只读取持久 Investigation 索引，在既有结构筛选后以独立字段和 relation summary segment 匹配，并在完整确定集形成后应用既有 `--limit`。

Proves:
- metadata 的 all、phrase、relation summary 和 limit 分别按字段 segment、来源 relation 与 sourcePath 确定顺序产生可观察结果；relation type 和 target 不会使来源报告命中，输出只列实际命中的字段和 relation。
- CLI 省略 `--in` 与显式 `--in content` 具有相同输出；metadata CLI 不输出内容行预览。
- 读取报告 Markdown 会使测试失败；索引缺失时 metadata 搜索失败并提供 `check`、`sync-index` recovery，而不回退到实体。
