### Case DECISION-METADATA-SEARCH-001: Metadata search 只匹配已发布字段和来源关系摘要

Tests:
- `test:5df99a1c4dda6f16302820cb8394a8c1fa4ec099c4c41266039102375ce2b860`

Tags:
- `decision-records`

Contract:
- `search --in metadata` 只在已发布 Decision 索引的字段白名单、单个 tag 和来源记录的非空 relation summary 中匹配；all 可跨 segment，phrase 不跨 segment，relation type 和 target 不作为自由文本字段。

Proves:
- 原生 metadata 投影对 NFKC title 与 tag 跨段 all 返回匹配字段且不输出 previews；跨段 phrase 不命中。
- 关系摘要 phrase 只返回来源记录及匹配 type、target、summary；关系类型与目标文本不作为该来源的自由文本匹配。
