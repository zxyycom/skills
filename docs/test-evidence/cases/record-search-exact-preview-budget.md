### Case RECORD-SEARCH-BUDGET-001: 恰好满额与未返回记录不制造预览截断

Tests:
- `test:318be398c9abab77f5b92566dffa8e44da31e23b1dc46429bab9ca1380a960c7`

Tags:
- `record-search`

Contract:
- 预览覆盖只描述已返回记录的实际省略；隐藏记录的片段不参与预览限制。

Proves:
- 恰好使用全部范围与字符预算仍 previewsComplete=true；最后文件的隐藏命中计入 exact 总数并只产生 max-records。
