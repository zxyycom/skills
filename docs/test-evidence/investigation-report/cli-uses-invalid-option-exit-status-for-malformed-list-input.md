### Case INVESTIGATION-CLI-USAGE-001: CLI uses invalid-option exit status for malformed list input

Entry:

- `tools/investigation-report/tests/cli-generated.test.ts > CLI uses invalid-option exit status for malformed list input`
- `bun test --test-name-pattern="^CLI uses invalid-option exit status for malformed list input$" ./tools/investigation-report/tests/run.ts`

Contract:

- 直接调用的源码 CLI 入口对非法报告级 list 选项返回稳定用法错误。

Proves:

- 非正整数 `--limit` 返回退出码 2、stdout 为空且 stderr 给出该选项的诊断。
