### Case DECISION-CLI-EVOLVE-RECORDED-FLAG-001: Evolve 的已记录删除参数必须配合 discard

Tests:
- `test:dc79cb328bd4d8b3b22384f3275da57542abfef945d3c3dbaa5410c7b4d84418`

Tags:
- `decision-records`

Contract:
- `--delete-recorded` 仅确认 `--discard <decision-id>` 选定目标的删除，不是独立演进选项。

Proves:
- evolve 仅传该参数时以退出码 2 在 Commander 参数边界拒绝，stdout 为空，stderr 给出稳定的 `--delete-recorded requires --discard <decision-id>` 诊断。
