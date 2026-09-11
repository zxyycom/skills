### Case DECISION-CLI-DISCARD-RECORDED-FLAG-001: Discard 帮助展示已记录决策删除参数

Tests:
- `test:b766155e931f6a092fc9a8aaae3b98cf3fd62f593b07afd47fa0f263a129e644`

Tags:
- `decision-records`

Contract:
- CLI 必须公开删除已进入 Git `HEAD` Decision ID 所需的 `--delete-recorded-decision` 显式参数。

Proves:
- `discard --help` 展示参数及其 Git HEAD 适用说明。
