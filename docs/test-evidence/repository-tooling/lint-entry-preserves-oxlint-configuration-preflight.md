### Case REPO-LINT-PREFLIGHT-001: lint 入口保留 Oxlint 配置前置校验

Entry:
- `scripts/validators/project-config.test.ts > lint entry preserves Oxlint configuration preflight`
- `bun test --test-name-pattern="^lint entry preserves Oxlint configuration preflight$" ./scripts/validators/project-config.test.ts`

Contract:
- `lint` 与 `lint:fix` package scripts 必须委托仓库入口；入口必须在启动 Oxlint 前执行统一项目基线的配置前置校验，不能让直接调用 Oxlint 绕过配置门禁。

Proves:
- 把 `lint` 改为直接 Oxlint 命令时，项目配置校验会给出恢复前置入口的诊断。
- schema 合法但试图以配置级绕过统一基线的配置会让 lint 入口失败，且不会执行 Oxlint。
