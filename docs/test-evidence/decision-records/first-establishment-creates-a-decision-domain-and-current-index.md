### Case DECISION-FIRST-ESTABLISHMENT-001: 首次建立创建根目录 Decision ID 与定义六索引

Entry:
- `tools/decision-records/tests/first-establishment.test.ts > first establishment creates a root Decision ID and definition-six index`
- `bun test --test-name-pattern="^first\ establishment\ creates\ a\ root\ Decision\ ID\ and\ definition\-six\ index$" ./tools/decision-records/tests/run.ts`

Contract:
- 空 workspace 首次建立候选时必须在根目录创建活动 Decision ID，并生成 definition version 6 的 ID 键索引。

Proves:
- 首次建立后记录位于根目录，索引使用当前定义版本及稳定 ID 键。
