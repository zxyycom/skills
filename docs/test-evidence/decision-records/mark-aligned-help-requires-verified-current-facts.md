### Case DECISION-CLI-MARK-ALIGNED-HELP-001: Mark-aligned 帮助要求核验当前事实
Entry:
- `tools/decision-records/tests/cli-args.test.ts > mark-aligned help requires verified current facts`
- `bun test --test-name-pattern="^mark-aligned help requires verified current facts$" ./tools/decision-records/tests/run.ts`
Contract:
- Mark-aligned 的公开帮助必须把对齐建立在完整方向已成为当前事实并完成相关事实源核验之后。
Proves:
- `mark-aligned --help` 成功并完整包含当前事实与事实源核验前提。
