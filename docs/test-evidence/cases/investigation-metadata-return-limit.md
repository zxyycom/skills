### Case INV-SEARCH-METADATA-001: 元数据保留精确全集计数并标记隐藏返回

Tests:
- `test:70fed2ed8864d3f7ccd99df532168bb6f54d5c726b38137eb6e92afa661a3655`

Tags:
- `record-search`

Contract:
- Investigation metadata 全量匹配后限量返回，扫描完整、matched 精确，只有隐藏命中才标记 max-records。

Proves:
- 两条命中限量一条时 matched=2、returned=1、scanComplete=true、resultsComplete=false、previewsComplete=null，并只报告返回限制。
- limit 恰好等于命中数时返回完整，不产生截断 warning。
