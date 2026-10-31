### Case INVESTIGATION-BUNDLED-PARITY-001: CLI exposes only report-level commands and rejects old topic options

Tests:
- `test:e1aa9062a509a9dea911c9ce62ca8aef60b232a38155876a29e1d7fe42de7f98`

Tags:
- `investigation-report`

Contract:
- 直接调用的源码 CLI 入口的帮助仅公开当前报告级命令；search 公开文本与匹配模式入口，sync-index 公开局部 `--select`、未选当前性未检查和 `--preflight` 而不保留 `--write`，旧 topic 筛选和 list 的 retired text 参数不属于当前接口。

Proves:
- 顶层帮助成功且只写 stdout，列出报告级命令而不列出 `--category`。
- search 帮助公开 `[text]` 位置入口和 `--match <mode>`。
- sync-index 帮助公开 `--select <name-or-id>` 局部更新、未选来源当前性未检查与 `--preflight`；同进程源码 CLI 的 `sync-index --write` 以用法错误退出并报告 `unknown option '--write'`。
- `list --category` 与 `list --text` 都以用法错误退出，且前者 stdout 为空、错误输出包含对应未知选项诊断。
