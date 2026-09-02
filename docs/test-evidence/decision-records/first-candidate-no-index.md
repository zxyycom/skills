### Case DECISION-CANDIDATE-FIRST-DISCOVERY-001: 首个候选无需既有索引即可发现

Entry:
- `tools/decision-records/tests/candidate-lifecycle.test.ts > first candidate discovery succeeds with no established records and no index`
- `bun test --test-name-pattern="^first candidate discovery succeeds with no established records and no index$" ./tools/decision-records/tests/run.ts`

Contract:
- 真正没有 established records 且没有 index 时，首个合法 candidate scaffold 仍可从来源发现。

Proves:
- 仅有一条 candidate 的 workspace 返回该候选。
