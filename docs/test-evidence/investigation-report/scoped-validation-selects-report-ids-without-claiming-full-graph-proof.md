### Case INVESTIGATION-REPORT-VALIDATION-SCOPE-001: scoped validation selects report ids without claiming full graph proof

Entry:
- `tools/investigation-report/tests/parsing-directory.test.ts > scoped validation selects report ids without claiming full graph proof`
- `bun test --test-name-pattern="^scoped validation selects report ids without claiming full graph proof$" ./tools/investigation-report/tests/run.ts`

Contract:
- 按 Investigation ID 的 scoped validation 只证明所选报告，不声明完整关系图或索引已验证。

Proves:
- 局部校验返回一个 selected report 且 `indexChecked` 为 false。
