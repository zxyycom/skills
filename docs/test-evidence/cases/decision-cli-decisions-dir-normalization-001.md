### Case DECISION-CLI-DECISIONS-DIR-NORMALIZATION-001: 相对决策目录在参数边界规范化

Tests:
- `test:bfe3718702b0fe494c495b1a9d516fc334ba8c71db1e74cc993dbaf178c01dab`

Tags:
- `decision-records`

Contract:
- 相对 `--decisions-dir` 在 CLI 参数边界规范化为工作区内相对路径后，再进入领域处理。

Proves:
- `./docs/decisions/` 输入解析为 `docs/decisions` 后才传给领域处理器。
