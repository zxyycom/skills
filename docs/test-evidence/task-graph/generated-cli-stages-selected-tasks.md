### Case TASK-GRAPH-DISTRIBUTION-STAGE-001: 分发 CLI 可在无 native runtime 时分段暂存

Entry:
- `tools/task-graph/tests/generated-artifacts.test.ts > generated Node CLI stages selected task entries without native runtime`
- `bun test --test-name-pattern="^generated Node CLI stages selected task entries without native runtime$" ./tools/task-graph/tests/run.ts`

Contract:
- Task-graph 分发 bundle 必须内含分段暂存所需的版本管理实现，并在受支持 Node.js 下保持与源码相同的 Git pending 契约。

Proves:
- 真实生成 MJS 在隔离 Git 仓库中只暂存选中 task，保留未选中 task 的 HEAD 条目与完整工作区候选。
- 命令输出稳定文本且不创建空 tool home，证明该路径没有加载或安装 native mutation runtime。
