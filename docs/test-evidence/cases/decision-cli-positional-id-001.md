### Case DECISION-CLI-POSITIONAL-ID-001: CLI 在位置参数边界验证 Decision ID

Tests:
- `test:76caa9f7d3b144a156c193966a180369f5e92d7b2431d111cf994a40a71fa7ca`

Tags:
- `decision-records`

Contract:
- 所有接受位置式 Decision ID 的 CLI 命令必须在 Commander 参数边界拒绝非法 extensionless ID。

Proves:
- `activate`、`archive`、`discard`、`mark-aligned`、`show`、`show-candidate`、`stage` 和 `trace` 对非法 ID 均以退出码 `2` 结束、不写 stdout，并在 stderr 说明 ID 无效。
