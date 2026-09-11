### Case DECISION-METADATA-SEARCH-001: Metadata search 只匹配已发布字段和来源关系摘要

Tests:
- `test:0192300626e604494eeac9e11f8fc0793aa51dc0fabe0e64d0069fd464e4cdbe`

Tags:
- `decision-records`

Contract:
- `search --in metadata` 只在已发布 Decision 索引的字段白名单、单个 tag 和来源记录的非空 relation summary 中匹配；all 可跨 segment，phrase 不跨 segment，relation type 和 target 不作为自由文本字段。

Proves:
- NFKC 的 title 与 tag 可共同满足 all，并以固定字段顺序输出 matchedFields，且不输出 content preview。
- 跨 title/tag 的 phrase 不命中；relation summary 的 phrase 只返回其来源记录和实际命中的 type、target、summary，type 本身不命中。
