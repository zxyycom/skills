### Case INVESTIGATION-SEARCH-METADATA-001: metadata search reads only its index and formal reports and reports match evidence

Tests:
- `test:1152418bfd7aa375121fd3658d0b3d699db9eb8a4db4b39674987cb2871f2bda`

Tags:
- `investigation-report`

Contract:
- `search --in metadata` 只读取持久 Investigation 索引与正式报告 Markdown，在既有结构筛选后以独立字段和 relation summary segment 匹配，并在完整确定集形成后应用既有 `--limit`。

Proves:
- metadata 的 all、phrase、relation summary 和 limit 分别按字段 segment、来源 relation 与 sourcePath 确定顺序产生可观察结果；relation type 和 target 不会使来源报告命中，输出只列实际命中的字段和 relation。
- CLI 省略 `--in` 与显式 `--in content` 具有相同输出；metadata CLI 不输出内容行预览。
- 读取索引与正式报告 Markdown 之外的文件会使测试失败；索引缺失时 metadata 搜索失败并提供 `check`、`sync-index` recovery，而不回退到任意来源。
