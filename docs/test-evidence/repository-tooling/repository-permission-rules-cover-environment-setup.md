### Case ENV-PERMISSION-RULES-001: 仓库权限规则覆盖环境 setup 且拒绝死入口
Entry:
- `scripts/validators/project-config.test.ts > repository permission rules cover environment setup without stale or blanket entries`
- `bun test --test-name-pattern="^repository permission rules cover environment setup without stale or blanket entries$" ./scripts/validators/project-config.test.ts`
Contract:
- 项目配置校验必须保持环境 check 的只读 allow、setup 与仓库配置入口的 prompt，并拒绝已删除脚本或 task-graph 混合读写 launcher 的 blanket 权限。
Proves:
- 当前 `.codex/rules/bun.rules` 包含全部必要环境权限且没有阻断诊断。
- 替换为已删除的 TypeScript hook 入口并 blanket allow task-graph 后，校验同时报告缺失 prompt、死引用与过宽权限。
