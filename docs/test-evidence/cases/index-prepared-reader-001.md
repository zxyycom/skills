### Case INDEX-PREPARED-READER-001: 严格字段物化沿准备证明交给 reader

Tests:
- `test:da0a764c1337284c5fbf16e17997ee387d7719f7aeece01d0c032931f5a2e3b1`

Tags:
- `index-runtime`

Contract:
- 严格 reader 复用同阶段字段物化，raw 输入仍独立验证。

Proves:
- 严格加载后多次 reader 查询不重做 parse/字段提取；raw reader/query 仍拒绝坏输入。
