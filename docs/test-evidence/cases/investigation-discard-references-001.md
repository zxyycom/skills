### Case INVESTIGATION-DISCARD-REFERENCES-001: discard rejects referenced reports and owner resources

Tests:
- `test:f35bc89d70e26f6832573448b6b33a384d244b9b7a4b2f7e122ce6bc3c9f0e65`

Tags:
- `investigation-report`

Contract:
- `discard` 不得删除仍作为其他报告直接关系 target 的报告，也不得删除仍被其他报告引用的 owner-prefix 资源。

Proves:
- 同时存在关系和共享资源引用时，操作返回两类可行动诊断，报告和索引字节保持不变。
