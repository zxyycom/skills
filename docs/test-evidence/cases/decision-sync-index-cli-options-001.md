### Case DECISION-SYNC-INDEX-CLI-OPTIONS-001: sync-index CLI 默认发布并以 preflight 分离零写入

Tests:
- `test:2ddcab0aaa7a1f57c11d3cd610836afec3d474e41f40ca49424035f2aff284af`

Tags:
- `decision-records`

Contract:
- Decision `sync-index` 的 CLI 帮助必须把默认完整来源验收、显式 `--select <name-or-id>` 已知位置与必要依赖范围和零写入 `--preflight` 作为同一命令协议公开，且不再提供 `--write`。

Proves:
- `sync-index --help` 区分默认full来源验收、selected已知位置更新及未选来源当前性未检查，并列出 `--select <name-or-id>` 与 `--preflight` 而不含 `--write`；`sync-index --write` 以 usage 错误退出并报告 unknown option。
