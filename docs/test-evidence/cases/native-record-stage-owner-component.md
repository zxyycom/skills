### Case NATIVE-RECORD-STAGE-OWNER-COMPONENT-001: 资源 owner 选择的路径分量

Tests:
- `test:a61099a25faf2a33ff3dc56eddde1520a08b8c6057dfc21c6bca94f1d2510a31`

Tags:
- `record-rust`

Contract:
- 资源 owner 范围必须按路径分量匹配，不能接受相似前缀。

Proves:
- 固定路径分别断言 owner 根和后代命中，以及 owner 与资源根相似前缀不命中。
