### Case DECISION-STAGE-REVISION-BATCH-001: Stage 对完整决策快照限制 Git 调用数

Entry:
- `tools/decision-records/tests/stage.test.ts > stage keeps Git invocation counts bounded for complete decision snapshots`
- `bun test --test-name-pattern="^stage keeps Git invocation counts bounded for complete decision snapshots$" ./tools/decision-records/tests/run.ts`

Contract:
- Stage 仍以完整 revision 决策集合构造并验证 pending 快照，但 revision 基线读取与未变化 pending entry 复用不得使 Git 进程数随集合文件数线性增长。

Proves:
- 在 fixture 建立完成后，150 与 300 个决策的未修改 stage 各不超过 20 次 Git 调用，且 pending 保持无变化。
- 修改一个选中决策后，150 与 300 个决策各不超过 25 次 Git 调用，并暂存包含修改后标题的选中 Markdown，以及为该标题重建的完整派生索引。
