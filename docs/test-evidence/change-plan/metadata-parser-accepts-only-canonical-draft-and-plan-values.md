### Case CHANGE-PLAN-METADATA-SCHEMA-001: Metadata parser 只接受规范 Draft 与 Plan
Entry:
- `tools/change-plan/tests/metadata.test.ts > metadata parser accepts only canonical draft and plan values`
- `bun test --test-name-pattern="^metadata parser accepts only canonical draft and plan values$" ./tools/change-plan/tests/run.ts`

Contract:
- 公共 metadata parser 的规范 schema 只包含 Draft 与带非空基线的 Plan。

Proves:
- `{ stage: draft }` 与 `{ stage: plan, baseCommit: <non-empty-revision> }` 被接受。
- null base、额外字段、带空白 revision 及规范联合之外的 stage 形状被拒绝。
