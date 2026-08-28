### Case INVESTIGATION-INDEX-COMPATIBILITY-001: index rejects legacy definitions and additional metadata

Entry:
- `tools/investigation-report/tests/index-query.test.ts > index rejects legacy definitions and additional metadata`
- `bun test --test-name-pattern="^index rejects legacy definitions and additional metadata$" ./tools/investigation-report/tests/run.ts`

Contract:
- 索引只接受当前定义和严格空 metadata。

Proves:
- 旧 definition 或额外 metadata 使查询返回错误。
