### Case NATIVE-OVERLAY-NESTED-001: 多级目标规划与失败清理

Tests:
- `test:5ca7bf26a0a657de5c9e33f3d211fc7115f3b124e30edaa8aa1c1e5ee5ab19a6`

Tags:
- `repository-tooling`

Contract:
- 缺失多级目标只读规划不写，失败应清理本次创建空目录。

Proves:
- 临时目录中规划不产生文件，校验失败后新建空目录被清理。
