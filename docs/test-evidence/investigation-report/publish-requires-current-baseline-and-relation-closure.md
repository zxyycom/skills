### Case INVESTIGATION-CANDIDATE-PUBLISH-002: publish requires current baseline and relation closure

Entry:

- `tools/investigation-report/tests/publish.test.ts > publish requires selected relation closure and a fresh formal index`
- `bun test --test-name-pattern="^publish requires selected relation closure and a fresh formal index$" ./tools/investigation-report/tests/run.ts`

Contract:

- publish 只能以新鲜正式索引为基线，且 selected candidates 的关系 target 必须在正式基线或同批 selection 内闭合。

Proves:

- 未选择且不存在的 relation target 阻断预检并保留 candidate。
- 手工正式 Markdown 漂移先要求 `sync-index`；同步后相同候选可完成预检。
