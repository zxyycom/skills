### Case DECISION-SYNC-INDEX-CLI-OPTIONS-001: sync-index CLI 明确公开 selected scope 与写入控制

Tests:
- `test:6159067e404ad640d269443d2ab9b37d3557a4499cf7ddf211c17d044916128e`

Tags:
- `decision-records`

Contract:
- Decision `sync-index` 的 CLI 帮助必须把从 established Markdown 检查或重建索引、显式 `--select` 范围和 `--write` 写入控制作为同一命令协议公开。

Proves:
- `sync-index --help` 说明其 established Markdown 输入，并列出 `--select <name-or-id>` 与 `--write`；追加 `--write` 的调用不因 usage 形状失败。
