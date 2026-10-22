# Tasks

任务已按[验收证据](verification.md)逐项核对，版本保存与结项按 Change Plan 流程执行。

## Readiness

- [x] 0.1 核对 quick 十项 eligible、changed/full/CI/release 范围与参数兼容，确认原生选择及成功前置闭包。
- [x] 0.2 核对总墙钟、原生执行样本、nearest-rank、缺失/非法数据与 quick receipt 不发布的成功授权边界。
- [x] 0.3 核对稳定 owner、Decision 修订前序和测试/Case 所有权，保留无关改动及发布输入边界。

## Implementation

- [x] 1.1 实现稳定入口、启动 PATH 规范化和 scope/CI/release 选择；保留完整 Definition、原生 flags、依赖、learned 调度和资源边界。
- [x] 1.2 实现性能统计、quick 严格预算、机器报告、报告写入失败政策和最终退出控制；quick 不发布或清除 receipt，changed 保持原有成功事务。
- [x] 1.3 同步 CLI/Definition/性能直接测试及最小原生测试 Case/index，覆盖精确阈值、选择与兼容边界。
- [x] 1.4 同步 AGENTS、tooling、Gate 接入约定和自包含 Decision 后继，核对旧 active 判断的引用与状态。

## Verification

- [x] 2.1 运行相关直接测试与 `bun run test:check`，确认选择、预算、报告写入失败、receipt 和兼容路径的结果，并核对 quick/changed/all 实际入口环境一致性。
- [x] 2.2 运行类型、lint、格式、仓库与 Case/index 检查，核对当前修改及派生索引一致性。
- [x] 2.3 运行 `bun run check`，如实记录 quick 的实际执行、耗时、预算、receipt 与退出结果。
- [x] 2.4 运行 `bun run check:changed` 完成变更验收并以紧接的 quick 核对精确 receipt 复用；核对 CI/full/release 兼容证据，未运行冷 release 或真实 CI 时明确边界。
- [x] 2.5 完成独立审查和 AI-ready 文档核对，修复实质问题；核对 Decision 完整方向的对齐依据与 Change 交接状态。
