### Case INVESTIGATION-CANDIDATE-PUBLISH-005: publish rechecks candidate formal source and index drift

Entry:

- `tools/investigation-report/tests/publish.test.ts > publish rechecks candidate, formal source, and index drift before changing files`
- `bun test --test-name-pattern="^publish rechecks candidate, formal source, and index drift before changing files$" ./tools/investigation-report/tests/run.ts`

Contract:

- 普通 publish 在提交前必须重新验证 selected candidate、正式来源与当前索引；任一事实漂移时不改名 candidate 或写入正式报告、索引。

Proves:

- selected candidate、正式 Markdown 或索引在准备后变化时，写入器不会执行，candidate 保持在 authoring workspace。
