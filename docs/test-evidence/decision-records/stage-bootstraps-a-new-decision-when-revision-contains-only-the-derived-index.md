### Case DECISION-STAGE-INDEX-ONLY-BASELINE-001: Stage 从仅派生索引的 revision 基线建立决策

Entry:
- `tools/decision-records/tests/stage.test.ts > stage bootstraps a new Decision when revision contains only the derived index`
- `bun test --test-name-pattern="^stage bootstraps a new Decision when revision contains only the derived index$" ./tools/decision-records/tests/run.ts`

Contract:
- revision 决策范围只含 `decision-index.json` 时，Stage 必须把它视为没有 Markdown 基线，并以选中的 filesystem Decision 构造首个完整 pending 快照。

Proves:
- 新建有效 Decision 可成功 stage，而不会把空的 Markdown 路径范围解释为整个 revision。
- pending 同时包含新建 Markdown 与从该来源重建的 `decision-index.json` 条目。
