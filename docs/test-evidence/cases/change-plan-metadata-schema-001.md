### Case CHANGE-PLAN-METADATA-SCHEMA-001: Metadata parser 只接受规范 Draft 与 Plan

Tests:
- `test:a58ffd48fb046516fd30ab49ecd7aa2997c3314429b920d39409b79b5228249b`

Tags:
- `change-plan`

Contract:
- 公共 metadata parser 的规范 schema 只包含 Draft 与带非空基线的 Plan。

Proves:
- `{ stage: draft }` 与 `{ stage: plan, baseCommit: <non-empty-revision> }` 被接受。
- null base、额外字段、带空白 revision 及规范联合之外的 stage 形状被拒绝。
