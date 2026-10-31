### Case DECISION-CLI-POSITIONAL-ID-001: CLI 在位置参数边界验证 Decision ID

Tests:
- `test:410ac65e29edd9d430e5fb1d901aa148ae494144555573fd350cf7d6402efcb1`

Tags:
- `decision-records`

Contract:
- 所有接受位置式 Decision ID 的 CLI 命令必须在 Commander 参数边界拒绝非法 extensionless ID。

Proves:
- `publish`、`archive`、`discard`、`mark-aligned`、`show`、`show-candidate`、`stage` 和 `trace` 对非法 ID 均以退出码 `2` 结束、不写 stdout，并在 stderr 说明 ID 无效。
