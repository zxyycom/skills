### Case INVESTIGATION-INDEX-COMPATIBILITY-001: index rejects legacy definitions

Entry:

- `tools/investigation-report/tests/index-query.test.ts > index rejects legacy definitions`
- `bun test --test-name-pattern="^index rejects legacy definitions$" ./tools/investigation-report/tests/run.ts`

Contract:

- Investigation index 只接受当前 definition 版本。

Proves:

- 旧 definition 使公共 query 返回 definition 诊断。
