### Case INVESTIGATION-CLI-USAGE-001: CLI 暴露有界 list 参数并拒绝畸形或重复输入

Tests:
- `test:dfe8fd06119b3235afab8f27a4dfb80e162878e1c5e99059e26ac675445b9536`

Tags:
- `investigation-report`

Contract:
- 源码 CLI 的 list help 公开默认 10 条、最大 1000 条和 detail 入口；畸形或不可重复的报告级 list 选项返回稳定用法错误。

Proves:
- 非数字或非正 `--limit`、负 offset、非法 formedAt、重复 detail，以及重复 formedAt/limit/offset 选项均返回退出码 2 且 stdout 为空。
