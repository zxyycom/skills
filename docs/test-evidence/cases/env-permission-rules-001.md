### Case ENV-PERMISSION-RULES-001: 仓库权限规则覆盖环境 setup 且拒绝死入口

Tests:
- `test:66d47968f52efcd7c42ba11f1d716312950601ab3f4d590c060bf576f3371810`

Tags:
- `repository-tooling`

Contract:
- 项目配置校验必须保持环境 check 的只读 allow、setup 与仓库配置入口的 prompt，并拒绝已删除脚本或 task-graph 混合读写 launcher 的 blanket 权限。

Proves:
- 当前 `.codex/rules/bun.rules` 包含全部必要环境权限且没有阻断诊断。
- 替换为已删除的 TypeScript hook 入口并 blanket allow task-graph 后，校验同时报告缺失 prompt、死引用与过宽权限。
