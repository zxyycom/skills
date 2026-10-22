### Case DECISION-STAGE-REVISION-BATCH-001: Stage 对完整决策快照限制 Git 调用数

Tests:
- `test:5554d617afa1170624776eddf411dfbf8e5a7129b38d2c0dd21dc67bfac4990d`

Tags:
- `decision-records`

Contract:
- 独立 stage 使用两阶段输入验证与完整 pending CAS，其 Git 调用数不按未选存量逐条增长。

Proves:
- 64 条存量下，未变化与变更的单对象 stage 各不超过 32 次 Git 调用，且暂存正文与索引均准确。
