### Case DECISION-CLI-POSITIONAL-ID-001: CLI 在位置参数边界验证 Decision ID

Entry:
- `tools/decision-records/tests/cli-args.test.ts > positional Decision IDs are validated at every CLI command boundary`
- `bun test --test-name-pattern="^positional\ Decision\ IDs\ are\ validated\ at\ every\ CLI\ command\ boundary$" ./tools/decision-records/tests/run.ts`

Contract:
- 所有接受位置式 Decision ID 的 CLI 命令必须在 Commander 参数边界拒绝非法 basename。

Proves:
- `activate`、`archive`、`discard`、`mark-aligned`、`show`、`show-candidate`、`stage` 和 `trace` 对非法 ID 均以退出码 `2` 结束、不写 stdout，并在 stderr 说明 ID 无效。
