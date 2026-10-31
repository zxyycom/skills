### Case INVESTIGATION-DISCARD-REFERENCES-001: discard rejects referenced reports and owner resources

Tests:
- `test:ed2321b9d4b1156d922824d12298a01ad59394b2de3354a5c082668429753744`

Tags:
- `investigation-report`

Contract:
- `discard` 不得删除仍作为其他报告直接关系 target 的报告，也不得删除仍被其他报告引用的 owner-prefix 资源。

Proves:
- 同时存在关系和共享资源引用时，操作返回两类可行动诊断，报告和索引字节保持不变。
