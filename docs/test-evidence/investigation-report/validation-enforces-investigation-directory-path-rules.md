### Case INVESTIGATION-DIRECTORY-PATH-001: validation enforces investigation directory path rules

Entry:
- `tools/investigation-report/tests/parsing-directory.test.ts > validation enforces investigation directory path rules`
- `bun test --test-name-pattern="^validation enforces investigation directory path rules$" ./tools/investigation-report/tests/run.ts`

Contract:
- 调查目录配置必须满足当前工作区路径边界。

Proves:
- 不符合规则的目录配置返回路径诊断。
