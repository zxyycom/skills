### Case DECISION-CLI-EVOLVE-HELP-001: Evolve 帮助公开后继与完整关系选择

Tests:
- `test:044b684972d3aaa2bab5803cd4187e180a79bde08a7a41b08ce4730896448678`

Tags:
- `decision-records`

Contract:
- Evolve 帮助必须公开重复 successor、完整关系覆盖和显式空关系选择，且不再公开旧单后继 alignment 参数。

Proves:
- `evolve --help` 包含 `--successor`、`--clear-relations` 与完整最终关系集语义。
- 帮助不包含旧 `--alignment <value>` 参数。
