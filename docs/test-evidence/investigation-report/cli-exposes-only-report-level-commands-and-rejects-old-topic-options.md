### Case INVESTIGATION-BUNDLED-PARITY-001: CLI exposes only report-level commands and rejects old topic options

Entry:
- `tools/investigation-report/tests/cli-generated.test.ts > CLI exposes only report-level commands and rejects old topic options`
- `bun test --test-name-pattern="^CLI exposes only report-level commands and rejects old topic options$" ./tools/investigation-report/tests/run.ts`

Contract:
- CLI 只公开报告级命令和参数；旧主题筛选参数不属于当前接口。

Proves:
- `list --tag` 在当前报告集合成功。
- 旧 `--category` 参数以用法错误退出。
