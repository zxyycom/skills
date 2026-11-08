### Case DECISION-CLI-ARGS-001: 顶层帮助公开命令

Tests:
- `test:420d14768d535213189f03a210a58c05df48bf71092cebc6c8fddb6a59e09ad4`

Tags:
- `decision-records`

Contract:
- 顶层帮助公开当前主要命令，不列出独立 split 命令。

Proves:
- 真实原生 CLI 顶层帮助包含 evolve、new、show-candidate，不含 split；此节点未穷举全部命令。
