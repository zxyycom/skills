### Case TASK-GRAPH-DISTRIBUTION-IMPORT-001: 生成模块导入在空 tool home 无副作用

Tests:
- `test:f8ed57a0d6895d9009559c4dac78fd84a8ead32970ea6e462df3cde1def63c68`

Tags:
- `task-graph`

Contract:
- 导入生成 ESM 不读取或创建用户 runtime，不加载 addon，不写 stdout/stderr。

Proves:
- 显式受支持 Node 导入后输出为空，隔离 tool home 仍不存在。
