### Case INVESTIGATION-STRUCTURE-CHRONOLOGY-001: 完整报告结构与时间顺序受约束
Entry:
- `tools/investigation-report/tests/parsing-directory.test.ts > validation enforces complete report structure and chronology`
- `bun test --test-name-pattern="^validation enforces complete report structure and chronology$" ./tools/investigation-report/tests/run.ts`
Contract:
- 完整调查报告必须具备必需章节，并保持事件时间顺序。
Proves:
- 缺失结构和逆序时间线分别产生对应诊断。
