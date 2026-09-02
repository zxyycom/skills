### Case DECISION-CLI-LIFECYCLE-PREFLIGHT-001: Lifecycle preflight 保留真实选择参数

Entry:
- `tools/decision-records/tests/cli-args.test.ts > activate and evolve preflight retain their real lifecycle selection options`
- `bun test --test-name-pattern="^activate and evolve preflight retain their real lifecycle selection options$" ./tools/decision-records/tests/run.ts`

Contract:
- `activate` 与 `evolve` 的 preflight 必须是各自真实生命周期选择的只读模式，而不是另一套命令协议。

Proves:
- 两个命令的帮助都公开 `--preflight`，并说明预检不写入 Markdown、派生索引或 Git pending。
