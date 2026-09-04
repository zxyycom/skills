### Case DECISION-RENAME-RELATIONS-001: Decision rename 改写受管关系目标

Entry:
- `tools/decision-records/tests/rename.test.ts > Decision rename rewrites candidate and established structured relation targets`
- `bun test --test-name-pattern="^Decision rename rewrites candidate and established structured relation targets$" ./tools/decision-records/tests/run.ts`

Contract:
- Decision rename 必须把 candidate 与 established 记录中指向旧 ID 的结构化 relation target 改为新完整 ID。

Proves:
- candidate Markdown relation 保存新 ID。
- 建立索引中的 relation state 保存新 ID，集合检查通过。
