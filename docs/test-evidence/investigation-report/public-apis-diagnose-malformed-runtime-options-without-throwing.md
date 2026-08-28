### Case INVESTIGATION-PUBLIC-OPTIONS-001: public APIs diagnose malformed runtime options without throwing

Entry:
- `tools/investigation-report/tests/parsing-directory.test.ts > public APIs diagnose malformed runtime options without throwing`
- `bun test --test-name-pattern="^public APIs diagnose malformed runtime options without throwing$" ./tools/investigation-report/tests/run.ts`

Contract:
- 公共验证 API 必须把未经信任的运行时选项转换为诊断，而不抛出异常。

Proves:
- 非字符串 workspaceRoot 返回结构化错误。
