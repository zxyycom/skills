# Proposal

Change Plan 的生命周期收敛为 Draft、Plan 与 Archive，任务在 Plan 内推进，Git 距离只提示需要复核的项目变化。

## Why

Change Plan 只需要持久表达两种 active 内容状态：Draft 保存仍在形成的 proposal 与 design，Plan 保存完整 proposal、design、tasks 及其实际进度。变更前的 `implementation` 只复制 Plan 的 `baseCommit`，没有增加独立执行事实；`shelved` 也不能形成比 Plan、任务协调 owner 或普通删除更明确的机械边界。额外 stage 因而把计划内推进拆成了不必要的状态转换。

Git 距离能够说明 Plan 基线后项目演进了多少，却不能判断变化是否影响当前计划。调用方需要直接获得提交数、Change 目录外变化行数和复核建议，而不是先解释 assessment 分类再恢复原始证据。

## Outcome

- Active Change 只报告 `draft` 或 `plan`；完成后的 Change 以 archived 目录 status 保存历史。
- Readiness、Implementation 与 Verification 全部在 Plan 内推进，不再触发 stage 转换。
- CLI 只提供 `list`、`show`、`check`、`check-all`、`plan` 与 `archive`。
- Plan 查询直接报告基线后的提交数、Change 目录外变化行数和复核建议；结构化结果只保留原始距离证据。
- 旧版 active metadata 保持可读，并在下次显式运行 `plan` 时写回规范结构；archived 历史不解释 metadata。

## Scope

纳入范围：

- 定义 `draft -> plan -> archived` 生命周期，并让三个 tasks 区段都在 Plan 内推进。
- 将命令表面收敛为六个命令，明确 `plan` 的首次确认与基线刷新职责，以及 `archive` 的完成门禁。
- 分离规范 metadata 写入与旧版 active metadata 兼容读取。
- 保留 first-parent Git 距离原始证据，并为文本与结构化查询定义直接输出。
- 同步行为 owner、仓库 skill 概览、agent 入口、skill 版本、工具源码、生成 CLI、测试、测试证据和决策对齐状态。

非目标：

- 外部等待、执行租约和非线性协调继续由 Task Graph 承接；Change Plan 不从 checkbox 推导授权或第二执行状态。
- `baseCommit` 只承担 Git 距离起点，不扩展成 artifact 内容指纹、时间策略或项目自定义阈值。
- 放弃 Change 使用普通文件删除与版本控制流程，不增加删除、暂停或迁移命令。
- 旧版 active metadata 通过兼容读取自然收敛，不批量改写其他 active Change；archived 历史保持原样。

## Success Criteria

1. 规范 metadata 只写 `{ stage: "draft" }` 与具有非空 `baseCommit` 的 `{ stage: "plan" }`；active 查询只报告 draft 或 plan，archived 查询不解释历史 metadata。
2. 旧 implementation、shelved 与 `baseCommit: null` Plan 保持可发现；兼容读取不会改写文件，`plan` 能把目标写回规范结构。
3. CLI help、参数解析、程序化导出和行为说明只保留 `list`、`show`、`check`、`check-all`、`plan` 与 `archive`；删除命令返回普通未知命令错误，不保留隐藏别名。
4. `plan` 对结构有效的 Draft 或现有 Plan 记录当前 `HEAD`，不要求 Readiness 全部完成，也不因 Implementation 或 Verification 已有证据而拒绝；`archive` 只接受结构有效、基线可用且全部任务完成的 active Plan。
5. Plan 距离可用时，文本结果直接报告提交数、Change 目录外累计变化行数和行动提示；结构化结果只提供基线、HEAD、提交数和变化行数，可用距离不阻断检查或归档。
6. Plan 基线缺失、不可解析、不在当前 `HEAD` first-parent 历史或版本控制查询失败时，检查返回稳定、可行动的阻断诊断；完成语义复核后可以重新运行 `plan` 刷新基线。
7. 行为 owner、agent 入口、skill 版本、源码、生成 CLI、测试和 test-evidence case 保持一致；两条新决策在实现与验证完成后标记 aligned，目标测试、目录检查和 `bun run check` 通过。

## Affected Owners

- `skills/change-plan/SKILL.md`、`references/change-plan-contract.md` 与 `agents/openai.yaml`：触发后的生命周期、任务推进、命令、metadata、Git 距离提示和交付行为。
- `AGENTS.md`：仓库维护的 change-plan 概览，移除实施与机械搁置阶段描述。
- `tools/change-plan/src/`：metadata 读取与规范写入、阶段类型、兼容投影、Git 距离、查询、生命周期命令、归档和 CLI 输出。
- `tools/change-plan/tests/` 与 `docs/test-evidence/change-plan/`：每个新增、修改或删除的最小原生测试入口及其唯一测试证据 case。
- `scripts/build/change-plan.ts` 与 `skills/change-plan/scripts/change-plan.mjs*`：继续通过现有生成入口同步分发 CLI；只有生成边界本身变化时才修改 build owner。
- `docs/decisions/change-plan/simplify-change-lifecycle-to-draft-plan-and-archive.md` 与 `report-plan-git-distance-as-context.md`：保存生命周期和 Git 距离的长期方向与理由；决策索引同步反映它们已经对齐的当前基线。
