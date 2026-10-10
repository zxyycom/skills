### Case INVESTIGATION-CHECK-FIRST-ACQUISITION-001: 全量检查仅验证首次采集对象

Tests:
- `test:14bd6ef5246554bed48130a29fa43a8cee20e546f6f4dcd1321d97e51397ad9d`

Tags:
- `investigation-report`

Contract:
- 全量只读 check 验证首次采集对象，不承诺结束时来源仍未改变。

Proves:
- 首次读取后改变一个报告，check 仍验证首次对象通过且只读取它一次；下一次 check 发现漂移。
