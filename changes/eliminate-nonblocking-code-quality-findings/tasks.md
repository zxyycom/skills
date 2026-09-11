# Tasks

任务按度量可信度、owner 规模和依赖方向推进；每批以行为兼容与 finding 减量双重证据完成，最终由 cold release Gate 收口。

## Readiness

- [x] 0.1 从最近一次完整 Gate 的 machine records 固化 84 条文件 finding、305 条函数 finding及其 owner/metric 分布。
- [x] 0.2 读取仓库模型、导航、编码规范、工具链 Gate 契约以及 Change Plan 行为与固定结构。
- [x] 0.3 确认当前工作树、分支/远端状态、已有 active Changes 与本 Change 的重叠边界。
- [x] 0.4 为每个实施批次读取对应 skill/工具局部 owner、CodeGraph 调用影响、生成边界与 Test Evidence Case。

## Implementation

- [x] 1.1 修正自动化源码中的分析器边界误判，并重构 Gate、环境和 Test Evidence 项目适配的真实复杂函数/多职责文件。
- [x] 1.2 重构 `tools/shared/`、`tools/index-runtime/` 与 `tools/skill-updater/` 的指标责任单元，保持共享依赖方向和公开导出。
- [x] 1.3 重构 `tools/change-plan/` 与 `tools/test-evidence/`，保持各自固定格式、事务和 CLI/SDK 契约。
- [x] 1.4 重构 `tools/mcpshell-workspace-bridge/` 与 `tools/task-graph/`，保持远端边界、store/runtime 与 task graph 语义。
- [x] 1.5 重构 `tools/decision-records/`，保持生命周期、关系事务、查询、CLI 与生成分发契约。
- [x] 1.6 重构 `tools/investigation-report/`，保持候选、验证、资源、关系事务、查询、重命名、发布与 CLI 契约。
- [x] 1.7 按行为责任拆分所有仍超限的测试文件，并同步 package scripts、Gate test catalog、Test Evidence Cases 与索引。
- [x] 1.8 同步受影响的构建适配、skill 生成产物和 `docs/tooling.md` 模块 owner；不复制各工具行为 owner。

## Verification

- [x] 2.1 每个 owner 批次的直接原生测试、失败路径和生成漂移检查通过。
- [x] 2.2 `bun run typecheck`、`bun run lint` 与 `bun run format:check` 在最终源码上通过。
- [x] 2.3 Test Evidence snapshot、Case 引用、索引同步与 catalog 检查通过，账本覆盖全部最终最小原生测试入口。
- [x] 2.4 `bun run check -- --tag release --cold` 的 62 个 Check 全部通过，`file-metrics` 和 `function-metrics` machine records 均为 0。
- [x] 2.5 审阅最终 diff，确认没有阈值/waiver 放宽、无责任 helper、公开行为漂移或无关改动，并完成稳定 owner 交接。
