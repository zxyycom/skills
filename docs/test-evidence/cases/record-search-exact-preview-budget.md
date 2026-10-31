### Case RECORD-SEARCH-BUDGET-001: 恰好满额与未返回记录不制造预览截断

Tests:
- `test:f7c8b5f8816114ee1d041f00d341ead8668df1f62a42c11eb383b27b073dff1d`

Tags:
- `record-search`

Contract:
- 预览覆盖只描述已返回记录的实际省略；隐藏记录的片段不参与预览限制。

Proves:
- 恰好使用全部范围与字符预算仍 previewsComplete=true；最后文件的隐藏命中计入 exact 总数并只产生 max-records。
