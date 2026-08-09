### Case DECISION-CLI-ACTIVATE-ALIGNMENT-001: Activate 要求 alignment 参数
Entry:
- `tools/decision-records/tests/cli-args.test.ts > activate requires an alignment argument`
- `bun test --test-name-pattern="^activate requires an alignment argument$" ./tools/decision-records/tests/run.ts`
Contract:
- Activate 必须由调用方显式提供建立后的 alignment。
Proves:
- 未提供 `--alignment` 的 activate 调用退出 2，并报告该必需选项。
