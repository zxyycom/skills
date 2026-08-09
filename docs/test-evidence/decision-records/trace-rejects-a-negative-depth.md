### Case DECISION-CLI-TRACE-DEPTH-001: Trace 拒绝负深度
Entry:
- `tools/decision-records/tests/cli-args.test.ts > trace rejects a negative depth`
- `bun test --test-name-pattern="^trace rejects a negative depth$" ./tools/decision-records/tests/run.ts`
Contract:
- Trace depth 必须是非负整数。
Proves:
- `--depth -1` 使 trace 退出 2 并报告 must be a non-negative integer。
