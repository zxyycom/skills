# Tasks

先固定 `Intended Change` 与 `Resulting Impacts` 的 artifact 结构，再实现结构门禁，最后同步测试证据和分发产物。

## Readiness

- [x] 0.1 核对 skill、固定契约、CLI owner、既有 Change 与测试证据边界。
- [x] 0.2 确认固定结构只在现有 Scope 与 Decisions 内增加 `Intended Change`、`Resulting Impacts` H3，并继续使用同一任务模型。

## Implementation

- [x] 1.1 重整 change-plan skill、固定契约、当前 Change 与长期决策。
- [x] 1.2 实现嵌套 H3 校验，并让 Draft、Plan 与 archived 检查对受检 `Scope`、`Decisions` 使用同一内部结构。
- [x] 1.3 更新测试 fixture、原生测试入口和测试证据 case。
- [x] 1.4 同步随 skill 分发的 Change Plan CLI 产物。
- [x] 1.5 按 ai-ready-docs 统一术语、阅读路径和 owner 层级。
- [x] 1.6 按项目编码规范收敛领域类型、结构契约和验证函数职责。
- [x] 1.7 按最小原生测试入口拆分 H3 诊断测试并同步测试证据与分发产物。

## Verification

- [x] 2.1 运行 Change Plan 目标测试、生成一致性和当前 Change 结构检查。
- [x] 2.2 运行仓库 quick 检查并审阅 skill、reference 与 CLI 的语义重心。
- [x] 2.3 重新运行目标测试、生成检查、测试证据检查和仓库完整检查。
