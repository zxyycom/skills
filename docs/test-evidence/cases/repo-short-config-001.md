### Case REPO-SHORT-CONFIG-001: 项目配置固定维护短命令、项目证据检查与权威 Vibe 门禁

Tests:
- `test:bb411a560c9c9ce019fa85b8f1db51d37bf435c877edf52457192e2971eb8e4b`

Tags:
- `repository-tooling`

Contract:
- 每个仓库维护短命令必须保留类型化映射指定的 package script 实现；`check:test-evidence-catalog` 必须委托项目快照、引用与覆盖 wrapper；`check` 必须唯一委托 Vibe CLI，不能保留候选 `vibe-check` 入口。

Proves:
- 完整的最小 package script 集合、维护短命令委托和权威 `check` 入口一致时，项目配置校验没有诊断。
- 将 `decision-records` 改为其他脚本路径时，校验返回期望维护入口。
- 将 `check:test-evidence-catalog` 改回 Case-only 核心 CLI 时，校验返回项目 wrapper 的期望入口。
- 将 `check` 指回旧实现或加入候选 `vibe-check` 时，校验拒绝两个冲突状态。
