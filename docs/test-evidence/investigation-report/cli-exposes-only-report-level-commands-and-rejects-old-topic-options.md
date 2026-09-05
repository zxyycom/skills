### Case INVESTIGATION-BUNDLED-PARITY-001: CLI exposes only report-level commands and rejects old topic options

Entry:
- `tools/investigation-report/tests/cli-generated.test.ts > CLI exposes only report-level commands and rejects old topic options`
- `bun test --test-name-pattern="^CLI exposes only report-level commands and rejects old topic options$" ./tools/investigation-report/tests/run.ts`

Contract:
- 直接调用的源码 CLI 入口的帮助仅公开当前报告级命令；search 公开文本与匹配模式入口，旧 topic 筛选和 list 的 retired text 参数不属于当前接口。

Proves:
- 顶层帮助成功且只写 stdout，列出报告级命令而不列出 `--category`。
- search 帮助公开 `<text>` 和 `--match <mode>`。
- `list --category` 与 `list --text` 都以用法错误退出，且前者 stdout 为空、错误输出包含对应未知选项诊断。
