### Case INVESTIGATION-CLI-USAGE-001: CLI 暴露有界 list 参数并拒绝畸形或重复输入

Tests:
- `test:9686b1ef1738ac65bec6abae47b3caac38e50beb8a68e0d9373e3662cf6ecae4`

Tags:
- `investigation-report`

Contract:
- 源码 CLI 的 list help 公开默认 10 条、最大 1000 条和 detail 入口；畸形或不可重复的报告级 list 选项返回稳定用法错误。

Proves:
- 非数字或非正 `--limit`、负 offset、非法 formedAt、重复 detail，以及重复 formedAt/limit/offset 选项均返回退出码 2 且 stdout 为空。
