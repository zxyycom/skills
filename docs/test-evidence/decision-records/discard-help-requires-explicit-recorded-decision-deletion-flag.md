### Case DECISION-CLI-DISCARD-RECORDED-FLAG-001: Discard 帮助展示已记录决策删除参数
Entry:
- `tools/decision-records/tests/cli-args.test.ts > discard help requires an explicit recorded decision deletion flag`
- `bun test --test-name-pattern="^discard help requires an explicit recorded decision deletion flag$" ./tools/decision-records/tests/run.ts`
Contract:
- CLI 必须公开删除已进入 Git `HEAD` Decision ID 所需的 `--delete-recorded-decision` 显式参数。
Proves:
- `discard --help` 展示参数及其 Git HEAD 适用说明。
