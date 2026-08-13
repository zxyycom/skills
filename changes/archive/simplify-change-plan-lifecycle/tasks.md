# Tasks

按“确认契约与兼容边界、同步 owner 与实现、验证证据并对齐决策”的顺序完成本 Change。

## Readiness

- [x] 0.1 确认 AI 能从 proposal、design 与 tasks 直接恢复同一目标、范围、状态模型、命令边界、兼容策略、owner 和验收标准。
- [x] 0.2 以 active unaligned 建立两条 governing decision 作为本 Change 的实施输入，并通过闭合关系事务归档旧生命周期、基础 CLI、机械搁置距离与 Plan 基线决策。
- [x] 0.3 确认规范 stage、六个命令、Plan 内任务推进、archive 门禁、普通删除边界和直接距离提示没有阻塞开放问题。
- [x] 0.4 审计当前仓库与分发兼容性，确认旧 implementation、shelved 和 `baseCommit: null` Plan 由只读兼容边界处理，其他 active Change 与 archived 历史保持原样。
- [x] 0.5 核对工具源码、生成 CLI、skill 版本、仓库概览、测试实现、test-evidence case 与决策索引的 owner，确认生成文件和派生索引只通过既有同步入口更新。

## Implementation

- [x] 1.1 更新 `skills/change-plan/SKILL.md`、固定 contract、agent 默认提示、`AGENTS.md` 概览和 skill 独立版本，使规范规则表达 draft、plan、archive、六个命令与直接距离提示，旧 stage 只出现在兼容读取边界。
- [x] 1.2 建立只写 draft/plan 的规范 metadata schema 与 writer，并在 active metadata 读取边界投影旧 implementation、shelved 和 null-base Plan；archived metadata 继续只作为历史文件保留。
- [x] 1.3 将 lifecycle action、CLI parser、help、结果类型和导出收敛到 `plan`，让 Draft、现有 Plan 与旧版 Plan 投影都能在无 checkbox 进度门禁下写入当前基线。
- [x] 1.4 让 `archive` 直接门禁结构有效、基线可用且全部任务完成的 active Plan，同时保持路径身份重验、目标冲突和语义授权边界。
- [x] 1.5 让 check、show、catalog、list、check-all 和文本 renderer 直接消费 Git distance evidence，使用固定行动提示，并把 `list --stage` 收窄为 draft/plan；移除阈值和 assessment 类型。
- [x] 1.6 按新契约更新 change-plan 原生测试入口和 fixture，移除只证明旧阶段、旧命令或 assessment 的入口，并按单一测试意图重组必要证据。
- [x] 1.7 按每个保留的最小原生测试入口更新 `docs/test-evidence/change-plan/` case，删除失去入口的 case，并通过统一命令同步派生测试证据索引。
- [x] 1.8 通过 `bun run sync:change-plan-cli` 同步分发 MJS 与 source map，复核生成闭包、命令表面和模块导出只来自当前源码。

## Verification

- [x] 2.1 用 metadata、check 和 catalog 原生测试证明规范 writer 只写 draft/plan，旧版 active metadata 安全投影，null-base Plan 可发现但阻断，archived 历史仍不解释 metadata。
- [x] 2.2 用 lifecycle、archive 与 CLI 原生测试证明六个命令表面、Draft/Plan 重确认、无任务进度门禁、完整 Plan 归档，以及契约外命令按未知命令失败。
- [x] 2.3 用 Git-distance 与 CLI 输出测试证明零距离、非零距离、Change-only 提交排除、基线不可用与版本控制失败均返回约定证据、提示和退出状态，且不产生阈值分类。
- [x] 2.4 运行 `bun run test:change-plan-cli`、`bun run check:change-plan-cli`、`bun run validate-skill -- skills/change-plan`、`bun run check:test-evidence-catalog` 与 `bun run check:decisions`。
- [x] 2.5 运行 `bun run check` 和 `bun run check --full`，复核工作区中旧 active Change 仍可由新版 list/check-all 发现且不被自动改写，并确认无关改动保持不变。
- [x] 2.6 在行为 owner、源码、生成产物和验证全部成为当前事实后，将两条 governing decision 标记 aligned；重新运行决策严格检查，并逐项核对 proposal 成功标准。
- [x] 2.7 使用 AI-ready Docs 审核本次文档，并以 `docs/coding-style.md` 为权威全局审核受影响代码；修复发现的问题、同步测试证据与生成产物，并通过独立复核和完整门禁。
- [x] 2.8 获得用户明确归档授权并完成归档前最终审阅；勾选本项后运行 `archive`，并复核 archived 结果。
