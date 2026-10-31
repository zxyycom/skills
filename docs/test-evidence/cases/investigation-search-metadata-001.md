### Case INVESTIGATION-SEARCH-METADATA-001: metadata search 只查询发布索引并返回匹配证据

Tests:
- `test:791e9f726abb6ddc1dfbb557632dc9bb187f3e4cd94d436024e776596c76c3a4`
- `test:9afd6e20b46d22587420b7bf43fd27abff057b72c22266d0a1d881fd1e9cd208`

Tags:
- `investigation-report`

Contract:
- `search --in metadata` 只读取合法发布索引，在结构筛选后按独立字段和 relation summary segment 匹配，完整确定集形成后应用 limit。

Proves:
- all、phrase、relation summary 和 limit 按字段 segment、来源 relation 与 sourcePath 确定顺序产生结果；relation type 与 target 不使来源报告命中。
- CLI 默认与显式 content 一致；metadata 不输出正文行预览。读取索引以外文件会使测试失败；索引缺失时失败并提示恢复，不回退来源。
