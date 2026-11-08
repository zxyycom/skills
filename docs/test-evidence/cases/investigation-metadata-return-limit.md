### Case INV-SEARCH-METADATA-001: 元数据保留精确全集计数并标记隐藏返回

Tests:
- `test:045ca118cdb50dc7cd62c08d5230734cbd8e026b3e21144f29aa83e99afdd2b4`

Tags:
- `record-search`

Contract:
- Investigation metadata 全量匹配后限量返回，并区分精确匹配数与实际返回数。

Proves:
- 两条命中限量一条时 matched=2、returned=1、scanComplete=true、resultsComplete=false、previewsComplete=null，返回 max-records 原因。
