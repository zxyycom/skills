### Case TASK-GRAPH-DISTRIBUTION-STAGE-001: 分发 CLI 可在无 native runtime 时分段暂存

Tests:
- `test:5e002d12129577ba1d177c6d2a0c293b979dc3a2820a874a5e7c32c40b57f176`

Tags:
- `task-graph`

Contract:
- Task-graph 分发 TS 运行时 必须包含分段暂存所需的自有版本管理 TS 实现，并在受支持 Node.js 下保持与源码相同的 Git pending 契约。

Proves:
- 真实生成 TS 在隔离 Git 仓库中只暂存选中 task，保留未选中 task 的 HEAD 条目与完整工作区候选。
- 命令输出稳定文本且不创建空 tool home，证明该路径没有加载或安装 native mutation runtime。
