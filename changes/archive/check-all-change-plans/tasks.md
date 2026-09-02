# Tasks

本 Change 先收紧归档边界，再同步查询输出、测试证据与长期决策，最后以完整门禁验证 active 工作流。

## Readiness

- [x] 0.1 核对 archived 校验的固定契约、checker、catalog、CLI、类型、测试证据和既有长期决策。
- [x] 0.2 确认 archived 是归档前完成门禁后的历史快照，后续只允许发现和原始读取，不再产生当前有效性判断。
- [x] 0.3 确认复用现有 active Change，不建立父子 Change、历史格式或兼容分支。

## Implementation

- [x] 1.1 修改 checker、catalog、类型与 CLI，使 check/check-all 只校验 active，list/show 以非校验路径处理 archived。
- [x] 1.2 同步 Change Plan skill、固定契约、人类说明和长期决策，删除 archived artifact 检查与集合门禁语义。
- [x] 1.3 更新受影响原生测试及一入口一 case 的测试证据，并同步派生索引。
- [x] 1.4 提升 skill 版本并从 `tools/change-plan/` 同步 MJS 与 source map。
- [x] 1.5 修正项目工具链与其他 active Change 中的过期归档查询表述。

## Verification

- [x] 2.1 独立运行受影响的 checker、catalog 与 CLI 测试入口，确认历史内容没有被读取或验证。
- [x] 2.2 运行 Change Plan 完整测试、类型检查、lint、生成漂移、决策和测试证据检查。
- [x] 2.3 运行仓库完整门禁，审阅最终 diff，并确认未修改或迁移 archived Change。
- [x] 2.4 按 AI-ready 文档原则和仓库编码规范复核 owner、领域类型、边界失败与验证证据。
