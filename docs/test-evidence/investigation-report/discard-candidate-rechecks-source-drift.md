### Case INVESTIGATION-DISCARD-CANDIDATE-002: discard-candidate rechecks source drift

Entry:

- `tools/investigation-report/tests/publish.test.ts > discard-candidate detects candidate drift before committing its tombstone`
- `bun test --test-name-pattern="^discard-candidate detects candidate drift before committing its tombstone$" ./tools/investigation-report/tests/run.ts`

Contract:

- candidate discard 在移动 tombstone 前重新读取 candidate 与 owner resource 成员；漂移时零写入失败。

Proves:

- 准备后的 candidate Markdown 变化被检测，candidate 保留在 authoring workspace。
