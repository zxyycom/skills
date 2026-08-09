### Case DECISION-CLI-UNKNOWN-OPTION-001: CLI 拒绝未知选项
Entry:
- `tools/decision-records/tests/cli-args.test.ts > decision CLI rejects unknown options`
- `bun test --test-name-pattern="^decision CLI rejects unknown options$" ./tools/decision-records/tests/run.ts`
Contract:
- 各子命令必须在参数边界拒绝未声明选项并使用参数错误退出码。
Proves:
- List 与 archive 收到 `--unknown-option` 时均退出 2 并报告 unknown option。
