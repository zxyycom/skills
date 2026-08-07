# Tasks

本清单按基础设施删除、当前契约同步和最终验收三个阶段收敛 task-graph 简化工作。

## Readiness

- [x] 0.1 已复盘源码、测试与提交规模，确认 native runtime 安装监督是最大非领域成本。
- [x] 0.2 已确认保留权威 JSON、原生短锁、revision CAS、task lease 和全部图语义，不回退到 stale lock、SQLite 或服务架构。
- [x] 0.3 已确认调用方显式执行 npm、锁进入系统临时目录、CLI 不修改 `.gitignore`、命令合并且不建设 registry。

## Implementation

- [x] 1.1 将 runtime 收缩为路径、结构化安装指引、直接版本检查、addon 加载和真实探针；删除内置安装与进程监督。
- [x] 1.2 删除 runtime 文本资产、构建同步、公开安装类型/错误和专属测试。
- [x] 1.3 将稳定锁迁到系统临时目录的索引路径 hash，删除工作区锁和符号链接逐级封锁。
- [x] 1.4 删除 `.gitignore` 管理，让 atomic reject 统一返回 `WRITE_OUTCOME_UNKNOWN`，成功不再回读。
- [x] 1.5 合并 `index info/check`、`scope list/gc/close` 和过期 lease `recover/claim` 命令。
- [x] 1.6 删除 Service 单操作 apply wrappers，让 CLI 直接使用 `apply`。
- [x] 1.7 同步公开声明、task-graph skill、项目说明、调查和独立版本。
- [x] 1.8 新增或演进长期决策，维护当前测试证据并清除只证明已删除行为的 case。

## Verification

- [x] 2.1 运行 typecheck、task-graph 专项测试、生成检查、skill 结构校验和测试证据检查。
- [x] 2.2 运行 `pnpm check --full`，确认全部门禁与打包通过。
- [x] 2.3 审计最终 diff、源码/测试规模、公开命令和删除矩阵，确认没有新建通用抽象或残留旧契约。
