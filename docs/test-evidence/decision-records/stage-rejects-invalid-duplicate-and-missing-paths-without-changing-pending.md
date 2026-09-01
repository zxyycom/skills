### Case DECISION-STAGE-INPUT-001: Stage 拒绝无效、重复和缺失 ID 且不改变 pending

Entry:
- `tools/decision-records/tests/stage.test.ts > stage rejects invalid duplicate and missing paths without changing the pending snapshot`
- `bun test --test-name-pattern="^stage rejects invalid duplicate and missing paths without changing the pending snapshot$" ./tools/decision-records/tests/run.ts`

Contract:
- stage 拒绝重复、缺失和越界 ID，并保留既有 Git pending 快照。

Proves:
- 三类非法输入均给出对应的参数或 selected-ID 诊断，选择来源、正式索引与 Git pending index 保持不变。
