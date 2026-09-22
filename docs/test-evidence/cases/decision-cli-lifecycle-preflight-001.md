### Case DECISION-CLI-LIFECYCLE-PREFLIGHT-001: Lifecycle preflight 保留真实选择参数

Tests:
- `test:d102c0cf13a40639a5c72eb29090ca18ecb6e3404ffb4fa6a9e313a10f74d56b`

Tags:
- `decision-records`

Contract:
- `publish` 与 `evolve` 的 preflight 必须是各自真实生命周期选择的只读模式，而不是另一套命令协议。

Proves:
- 两个命令的帮助都公开 `--preflight`，并说明预检不写入 Markdown、派生索引或 Git pending。
