### Case IR-INDEX-PAYLOAD-REQUIRED-FAILURE-001: index必需payload准备与写前失败

Tests:
- `test:e40c4c17a8a7708835163a870f4570cd849e8f9c7d50580fdbbec0283c1c0f3a`
- `test:f063e4f5f5ad81b46fdf0b6053e2c1be9af105ac97a805dc611dbb0a9326fe65`

Tags:
- `investigation-report`

Contract:
- IR index scope只排除非索引payload验收；必需pending索引payload在准备和独立写前均须可读。

Proves:
- 保持HEAD基线可读但删除独立pending索引对象时，准备或独立写前均报告stage-pending-read-failed，保留原pending条目。
