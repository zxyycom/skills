### Case REPO-SHORT-CONFIG-001: 项目配置固定维护短命令与权威 Vibe 门禁

Entry:
- `scripts/validators/project-config.test.ts > project package script validation preserves maintenance CLI delegations and the authoritative Vibe gate`
- `bun test --test-name-pattern="^project package script validation preserves maintenance CLI delegations and the authoritative Vibe gate$" ./scripts/validators/project-config.test.ts`

Contract:
- 每个仓库维护短命令必须保留类型化映射指定的 package script 实现；`check` 必须唯一委托 Vibe CLI，不能保留候选 `vibe-check` 入口。

Proves:
- 完整的最小 package script 集合、维护短命令委托和权威 `check` 入口一致时，项目配置校验没有诊断。
- 将 `decision-records` 改为其他脚本路径时，校验返回期望维护入口。
- 将 `check` 指回旧实现或加入候选 `vibe-check` 时，校验拒绝两个冲突状态。
