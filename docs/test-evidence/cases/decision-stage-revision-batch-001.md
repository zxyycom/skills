### Case DECISION-STAGE-REVISION-BATCH-001: Stage 对完整决策快照限制 Git 调用数

Tests:
- `test:5554d617afa1170624776eddf411dfbf8e5a7129b38d2c0dd21dc67bfac4990d`

Tags:
- `decision-records`

Contract:
- Stage 仍以完整 revision 决策集合构造并验证 pending 快照，但 revision 基线读取与未变化 pending entry 复用不得使 Git 进程数随集合文件数线性增长。

Proves:
- 在 fixture 建立完成后，条目数高于调用上限的 64 个决策中，未修改 stage 不超过 20 次 Git 调用，且 pending 保持无变化。
- 修改一个选中决策后，64 个决策的 stage 不超过 25 次 Git 调用，并暂存包含修改后标题的选中 Markdown，以及为该标题重建的完整派生索引；fixture 数量足以区分逐条 Git 调用回归，但不被误作行为本身。
