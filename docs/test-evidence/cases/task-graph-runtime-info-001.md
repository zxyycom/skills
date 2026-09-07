### Case TASK-GRAPH-RUNTIME-INFO-001: runtime info 的身份稳定且没有写副作用

Tests:
- `test:c2cfb53504e59fae5aa81622a76e4708bae5e4784f21741cc896bc0ee4b06bee`

Tags:
- `task-graph`

Contract:
- Runtime ID 与直接包版本固定，默认目录与环境覆盖稳定；缺失状态只返回结构化安装 argv，不创建持久文件。

Proves:
- 空环境使用默认 `~/.tools/task-graph`，非空环境完整覆盖；missing 结果返回固定 npm prefix 与精确包版本，两个 home 都未被创建。
