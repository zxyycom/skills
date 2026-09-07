### Case DECISION-LIFECYCLE-PREFLIGHT-001: 生命周期预写入拒绝来源漂移

Tests:
- `test:42ba479b001509e6664b2b03ff06cba20b3546c7565e738fff9c961f2d61f8fe`

Tags:
- `decision-records`

Contract:
- 生命周期事务在预写入 scan 后必须核验来源仍未变化，避免移动或覆盖并发内容。

Proves:
- 来源改写后事务报错，原路径仍在、目标路径未创建、既有归档 index 不变。
