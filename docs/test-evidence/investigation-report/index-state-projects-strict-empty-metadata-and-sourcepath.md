### Case INVESTIGATION-SNAPSHOT-DUPLICATE-STATE-001: index state projects strict empty metadata and sourcePath

Entry:
- `tools/investigation-report/tests/index-query.test.ts > index state projects strict empty metadata and sourcePath`
- `bun test --test-name-pattern="^index state projects strict empty metadata and sourcePath$" ./tools/investigation-report/tests/run.ts`

Contract:
- 报告索引 metadata 必须严格为空；entry 直接保存 state，且可回读其中的 sourcePath。

Proves:
- 持久化索引的 metadata 为 `{}`，报告 entry 直接保存 `report.md` sourcePath、没有 wrapper 或持久 query values，公开 schema 也声明并要求该字段。
