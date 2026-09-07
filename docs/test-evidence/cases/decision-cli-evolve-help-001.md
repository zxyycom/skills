### Case DECISION-CLI-EVOLVE-HELP-001: Evolve 帮助公开后继与完整关系选择

Tests:
- `test:94fc94ed70b2f49bd823ed2f65e6f2563d700966a50e84cba3a80048a8961126`

Tags:
- `decision-records`

Contract:
- Evolve 帮助必须公开重复 successor、完整关系覆盖和显式空关系选择，且不再公开旧单后继 alignment 参数。

Proves:
- `evolve --help` 包含 `--successor`、`--clear-relations` 与完整最终关系集语义。
- 帮助不包含旧 `--alignment <value>` 参数。
