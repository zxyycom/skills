### Case REPO-SHORT-CONFIG-001: 项目配置校验固定维护短命令委托
Entry:
- `scripts/validators/project-config.test.ts > project package script validation preserves maintenance CLI delegations`
- `bun test --test-name-pattern="^project package script validation preserves maintenance CLI delegations$" ./scripts/validators/project-config.test.ts`
Contract:
- 每个仓库维护短命令必须保留类型化映射指定的 package script 实现，而不只是保留同名脚本。
Proves:
- 完整的最小 package script 集合与映射一致时，项目配置校验没有诊断。
- 将 `decision-records` 改为其他脚本路径时，校验返回指明期望委托入口的稳定诊断。
