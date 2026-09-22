### Case DECISION-SYNC-INDEX-CLI-OPTIONS-001: sync-index CLI 默认发布并以 preflight 分离零写入

Tests:
- `test:2ddcab0aaa7a1f57c11d3cd610836afec3d474e41f40ca49424035f2aff284af`

Tags:
- `decision-records`

Contract:
- Decision `sync-index` 的 CLI 帮助必须把从 established Markdown 重建并发布完整 JSON 索引、显式 `--select <name-or-id>` 范围和零写入 `--preflight` 作为同一命令协议公开，且不再提供 `--write`。

Proves:
- `sync-index --help` 说明其 established Markdown 输入，并列出 `--select <name-or-id>` 与 `--preflight` 而不含 `--write`；`sync-index --write` 以 usage 错误退出并报告 unknown option。
