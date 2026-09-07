### Case DECISION-CLI-DISCARD-RECORDED-FLAG-001: Discard 帮助展示已记录决策删除参数

Tests:
- `test:8b97d807a46b4ea93985b79e17db0f7fca6f5113bbe1a3911d92a59e9a1d1d50`

Tags:
- `decision-records`

Contract:
- CLI 必须公开删除已进入 Git `HEAD` Decision ID 所需的 `--delete-recorded-decision` 显式参数。

Proves:
- `discard --help` 展示参数及其 Git HEAD 适用说明。
