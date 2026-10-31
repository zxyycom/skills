### Case INVESTIGATION-CHECK-FIRST-ACQUISITION-001: 全量检查仅验证首次采集对象

Tests:
- `test:565d5df32a6ae295d82c5ad469bd0676af6d3d3b3b8344cdc5bc41bf7680e915`

Tags:
- `investigation-report`

Contract:
- 全量只读 check 验证首次采集对象，不承诺结束时来源仍未改变。

Proves:
- 首次读取后改变一个报告，check 仍验证首次对象通过且只读取它一次；下一次 check 发现漂移。
