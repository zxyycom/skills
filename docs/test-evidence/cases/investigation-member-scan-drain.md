### Case INVESTIGATION-MEMBER-SCAN-DRAIN-001: 有界元数据读取排空后按名字返回首错

Tests:
- `test:d4967d63a4dc31b3f735f66172c41ecc1d6aaa324a801650908bfd6b3a9c1584`

Tags:
- `investigation-report`

Contract:
- 调查集合元数据按成员名排序、有界并发读取；失败时等待全部已启动读取结束，返回成员名排序最前的原始错误，且不启动后续批次。

Proves:
- 受控 promise 让排序第二的成员先失败、第一成员延迟失败；实际读取发生重叠且不超过 32 个，扫描在放行前保持等待。
- 放行后返回第一成员的原始 EACCES 错误对象；全部已启动读取均已结束，且没有启动后续批次。
