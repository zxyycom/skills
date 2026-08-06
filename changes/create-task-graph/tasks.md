# Tasks

任务先收敛运行位置、通用 owner 和事务协议，再按工具、skill、集成与验证顺序实施；全部任务当前均未开始。

## Readiness

- [ ] 0.1 完整读取 proposal、design、tasks 与五条活动未对齐 `task-graph` 决策，确认目标、范围、owner、实施输入和长期方向一致。
- [ ] 0.2 解决 design Q1，确定 task index 的默认运行位置、显式覆盖入口、scope 身份和多 Codex task 隔离规则。
- [ ] 0.3 解决 design Q2，调查 `index-runtime`、共享文件操作和 `version-control` 的可复用边界，决定使用专用 mutable-state 实现还是先建立真实通用 owner。
- [ ] 0.4 解决 design Q3，固定跨进程锁、revision 冲突、原子替换、租约续期、过期与强制恢复协议。
- [ ] 0.5 解决 design Q4 和 Q5，固定终态清理、最小控制状态、执行状态、失败重试和父任务完成契约，并消除全部阻塞开放问题。

## Implementation

- [ ] 1.1 在 `tools/task-graph/` 建立类型化源码、公开 API、CLI 参数和结果类型，并按 owner 调查结果接入必要共享原语。
- [ ] 1.2 实现 task index schema、稳定 ID、scope、content/state 分区、解析、确定性序列化、revision 和完整索引校验。
- [ ] 1.3 实现父子森林、依赖 DAG、对称排斥、祖先继承、局部软控制覆盖、反向查询和有效状态阻塞投影。
- [ ] 1.4 实现创建、显示、列表、关系维护、控制状态、trace、check 和机器可读查询命令。
- [ ] 1.5 实现事务 claim、complete、fail、release、pause、cancel、租约恢复以及失败时不保留部分结果的写入边界。
- [ ] 1.6 实现终态引用检查、结果消费边界、单 task 清理和根 scope 原子 `gc`/`close` 生命周期。
- [ ] 1.7 创建 `skills/task-graph/SKILL.md`、必要 references、生成后的 scripts、声明和 updater，使 skill 与工具形成完整分发单元。
- [ ] 1.8 更新 `docs/skills/task-graph.md`、`README.md`、`AGENTS.md` 及实际需要的构建、检查、打包和发布集成，不为既有导航模式复制领域规则。
- [ ] 1.9 为所有最小原生测试入口建立测试实现，并同步 `docs/test-evidence/test-evidence-topics.json`、对应 case 和统一派生索引。

## Verification

- [ ] 2.1 运行 schema、解析、规范化和 round-trip 测试，证明紧凑 content 与复杂 state 的边界稳定且非法组合被拒绝。
- [ ] 2.2 运行层级环、依赖环、悬空引用、排斥对称、祖先继承、局部覆盖和父任务完成策略测试。
- [ ] 2.3 运行并发领取、陈旧 revision、错误租约、排斥任务竞争、写入失败回滚、租约过期与恢复测试。
- [ ] 2.4 运行终态依赖保留、结果消费、单 task 清理、整 scope 清理和任务 ID 不复用测试。
- [ ] 2.5 使用现实请求验证 skill 的自然触发、简单线性 near miss、任务追加、并行任务、缺少 subagent-orchestration 时的降级和持久 change 交接。
- [ ] 2.6 运行 task-graph skill 结构验证、工具类型检查与测试、生成物检查、打包验证和 `bun run check`。
- [ ] 2.7 将完整实现与五条 task-graph 决策逐项核对；只有全部方向已经成为当前事实时才标记为 aligned，并运行决策集合严格检查。
