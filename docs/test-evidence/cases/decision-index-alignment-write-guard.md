### Case DECISION-INDEX-ALIGNMENT-WRITE-GUARD-001: 非法对齐值不能进入索引

Tests:
- `test:3eb58968e223b5442fd81087427261ffa3d1da3c98751e5873fba6237da0a3e5`

Tags:
- `decision-records`

Contract:
- 非法对齐值不能进入索引。

Proves:
- alignment:null 使 check 与 sync-index 失败并定位来源/字段，Markdown 与索引字节不变。
