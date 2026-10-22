### Case INVESTIGATION-DISCARD-CANDIDATE-001: discard 识别候选并保护共享与已记录资源

Tests:
- `test:bba3191900593fbfd6b7963c19de20dc1a1ecab8a0529b59f9c3db88cada6b3a`

Tags:
- `investigation-report`

Contract:
- 统一 `discard` 按稳定 ID 识别候选目标，只删除该候选及确认的 owner 资源；共享引用和 Git HEAD 记录先阻断，正式报告与索引不属于该事务。

Proves:
- 其他 candidate 引用 owner resource 时拒绝删除。
- Git 已记录 candidate 需要独立确认；确认后 candidate 与 owner resource 删除，正式报告字节不变。
