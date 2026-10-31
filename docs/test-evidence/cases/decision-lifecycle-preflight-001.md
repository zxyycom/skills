### Case DECISION-LIFECYCLE-PREFLIGHT-001: 生命周期预写入拒绝来源漂移

Tests:
- `test:264b0b52229ef4bece49f7e08b2399720ea1883f1e57e4838a85f7921b198c0c`

Tags:
- `decision-records`

Contract:
- 生命周期事务在预写入 scan 后必须核验来源仍未变化，避免移动或覆盖并发内容。

Proves:
- 来源改写后事务报错，并保留并发改写后的完整正文与 index 原始字节，archive 目标未创建。
