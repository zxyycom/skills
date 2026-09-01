### Case INVESTIGATION-CLI-WARNINGS-001: CLI show requires one Investigation ID

Entry:

- `tools/investigation-report/tests/cli-generated.test.ts > CLI show requires one Investigation ID`
- `bun test --test-name-pattern="^CLI show requires one Investigation ID$" ./tools/investigation-report/tests/run.ts`

Contract:

- 直接调用的源码 CLI 入口 `show` 只接受一个明确 Investigation ID。

Proves:

- 省略 ID 返回退出码 2、stdout 为空且 stderr 给出用法诊断。
