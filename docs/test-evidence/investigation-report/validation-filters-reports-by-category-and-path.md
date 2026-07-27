### Case INVESTIGATION-VALIDATION-FILTER-001: 调查校验按类别与路径筛选
Entry:
- `tools/investigation-report/tests/parsing-directory.test.ts > validation filters reports by category and path`
- `bun test --test-name-pattern="^validation filters reports by category and path$" ./tools/investigation-report/tests/run.ts`
Contract:
- 调查校验必须按 category 和目录路径限制目标报告。
Proves:
- 仅匹配范围的报告参与结果和诊断。
