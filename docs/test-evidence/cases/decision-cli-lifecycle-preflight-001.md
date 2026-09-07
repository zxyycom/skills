### Case DECISION-CLI-LIFECYCLE-PREFLIGHT-001: Lifecycle preflight 保留真实选择参数

Tests:
- `test:f0e6c65f050ad8de0149b0b970f48e234a75f85f24e30887a30c153d90a9defe`

Tags:
- `decision-records`

Contract:
- `activate` 与 `evolve` 的 preflight 必须是各自真实生命周期选择的只读模式，而不是另一套命令协议。

Proves:
- 两个命令的帮助都公开 `--preflight`，并说明预检不写入 Markdown、派生索引或 Git pending。
