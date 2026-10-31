### Case TASK-GRAPH-RUNTIME-INFO-001: runtime info 的身份稳定且没有写副作用

Tests:
- `test:47d808427db3933cf76c6fba0e510092b7fd8027cc8789929d55fb6aa10f757c`

Tags:
- `task-graph`

Contract:
- Runtime ID 与直接包版本固定，默认目录与环境覆盖稳定；缺失状态只返回结构化安装 argv，不创建持久文件。

Proves:
- 空环境使用默认 `~/.tools/task-graph`，非空环境完整覆盖；missing 结果返回固定 npm prefix 与精确包版本，两个 home 都未被创建。
