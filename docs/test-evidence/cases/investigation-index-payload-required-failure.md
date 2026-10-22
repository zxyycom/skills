### Case IR-INDEX-PAYLOAD-REQUIRED-FAILURE-001: index必需payload准备与写前失败

Tests:
- `test:16797b2dd8d9f604b0faf9ed9cc91b7a162c9e6ab0ab0ea0e7642b07571b0de0`
- `test:5f1c7c4a245b1b68addf5bfcccb763283fbbe2f51f48ad876f2568f2f37f522f`

Tags:
- `investigation-report`

Contract:
- IR index scope只排除非索引payload验收；必需pending索引payload在准备和独立写前均须可读。

Proves:
- 保持HEAD基线可读但删除独立pending索引对象时，准备或独立写前均报告stage-pending-read-failed，保留原pending条目。
