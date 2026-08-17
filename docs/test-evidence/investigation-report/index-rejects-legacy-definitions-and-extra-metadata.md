### Case INVESTIGATION-INDEX-COMPATIBILITY-001: 索引拒绝旧 Definition 与额外 Metadata

Entry:
- `tools/investigation-report/tests/index-query.test.ts > index rejects legacy definitions and additional metadata`
- `bun test --test-name-pattern="^index rejects legacy definitions and additional metadata$" ./tools/investigation-report/tests/run.ts`

Contract:
- 解析持久化调查索引时只接受 Schema v3、definition version 5 和严格空 metadata；旧 definition 或额外 metadata 字段不兼容。

Proves:
- Schema version 2 与 definition version 4 都被解析拒绝。
- 在 metadata 中加入旧的 `resources` 字段被额外属性校验拒绝。
