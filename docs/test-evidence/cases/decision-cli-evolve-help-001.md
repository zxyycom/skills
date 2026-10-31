### Case DECISION-CLI-EVOLVE-HELP-001: Evolve 帮助公开后继与完整关系选择

Tests:
- `test:f88abdb59e3bac33c3dba67d8b087d5e0997c1aa4370c4fdddcc3811ba3ba223`

Tags:
- `decision-records`

Contract:
- Evolve 帮助必须公开重复 successor、完整关系覆盖和显式空关系选择，且不再公开旧单后继 alignment 参数。

Proves:
- `evolve --help` 包含 `--successor`、`--clear-relations` 与完整最终关系集语义。
- 帮助不包含旧 `--alignment <value>` 参数。
