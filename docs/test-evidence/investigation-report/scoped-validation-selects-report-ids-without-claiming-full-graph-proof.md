### Case INVESTIGATION-REPORT-VALIDATION-SCOPE-001: scoped validation selects report ids without claiming full graph proof

Entry:

- `tools/investigation-report/tests/parsing-directory.test.ts > scoped validation selects report ids without claiming full graph proof`
- `bun test --test-name-pattern="^scoped validation selects report ids without claiming full graph proof$" ./tools/investigation-report/tests/run.ts`

Contract:

- scoped validation 只证明所选规范 Investigation ID，不声明完整关系图或 index 已验证。

Proves:

- 局部校验只选择一个报告且 `indexChecked` 为 false；`./` 与首尾空白输入得到 check-id 诊断。
