### Case INDEX-RUNTIME-EMPTY-RECORD-001: 物化空 State 与 Source Revision Record

Entry:
- `tools/index-runtime/tests/protocol.test.ts > materializes an empty state and source-revision record`
- `bun test --test-name-pattern="^materializes an empty state and source-revision record$" ./tools/index-runtime/tests/run.ts`

Contract:
- 状态与逐条来源 revision 可以同时为空，metadata revision 仍必须存在并产生合法空索引。

Proves:
- 空 state record 与空 `sourceRevision.entries` 成功物化为没有持久化条目的索引。
