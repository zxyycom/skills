### Case INVESTIGATION-DIRECTORY-PATH-001: 调查目录路径规则被执行
Entry:
- `tools/investigation-report/tests/parsing-directory.test.ts > validation enforces investigation directory path rules`
- `bun test --test-name-pattern="^validation enforces investigation directory path rules$" ./tools/investigation-report/tests/run.ts`
Contract:
- 调查报告必须位于配置允许且身份对齐的目录路径。
Proves:
- 越界、别名和无效目录结构产生路径诊断。
