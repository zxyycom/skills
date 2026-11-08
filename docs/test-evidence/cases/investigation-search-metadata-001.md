### Case INVESTIGATION-SEARCH-METADATA-001: metadata 跨字段搜索与限量

Tests:
- `test:045ca118cdb50dc7cd62c08d5230734cbd8e026b3e21144f29aa83e99afdd2b4`

Tags:
- `investigation-report`

Contract:
- metadata 搜索从索引状态按 all 模式跨字段匹配，完整匹配后才限量返回。

Proves:
- 搜索词分别匹配 title 和 question，两条匹配、返回一条，保留 matchedFields、精确匹配计数和 max-records 覆盖原因。
