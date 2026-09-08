### Case INVESTIGATION-CLI-USAGE-001: CLI 暴露有界 list 参数并拒绝畸形或重复输入

Tests:
- `test:8465fa71b4f43318fbba3469f7a9ad1f3884416c71a809032537165c01cad536`

Tags:
- `investigation-report`

Contract:
- 源码 CLI 的 list help 公开默认 10 条、最大 1000 条和 detail 入口；畸形或不可重复的报告级 list 选项返回稳定用法错误。

Proves:
- 非数字或非正 `--limit`、负 offset、非法 formedAt、重复 detail，以及重复 formedAt/limit/offset 选项均返回退出码 2 且 stdout 为空。
