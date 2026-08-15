### Case DECISION-STAGE-BOOTSTRAP-001: Stage 建立第一份 pending 决策集合

Entry:
- `tools/decision-records/tests/stage.test.ts > stage bootstraps the first pending decision collection`
- `bun test --test-name-pattern="^stage bootstraps the first pending decision collection$" ./tools/decision-records/tests/run.ts`

Contract:
- 没有既有决策目录时 stage 暂存首个记录及新索引。

Proves:
- 空 Git workspace 暂存首个 root ID 和 index。
