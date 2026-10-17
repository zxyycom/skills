# Change Plan

`change-plan` 为跨文件、owner 或验证阶段的明确变更保存可版本化、可审阅和可交接的临时计划，
帮助项目持续回答为什么做、采用什么设计、如何推进，以及怎样证明完成。

## 工作方式

1. Draft：用 `proposal.md` 明确 Outcome，用初始 `design.md` 收敛方案。
2. Plan：补全范围、设计和成功标准，派生 `tasks.md`，在同一计划内完成准备、实施与验证。
   `Intended Change` 表达预期调整，`Resulting Impacts` 表达由其引起且必须处理的影响。
3. 结项：全部 checkbox 如实完成后，在当前授权范围内连续保存 Git 完成态，再由 `finalize` 删除目录。
   当前 Git `HEAD` 必须能精确恢复最终计划；退出后历史由普通 Git 恢复。

任务或其验收条件完整承接成功标准、必要影响、owner 同步与必要知识交接；每次勾选都声明对应
工作及其验收已有证据。版本保存与安全删除是全勾后的收尾动作，业务验收已经随任务完成。

## 查询与边界

- `list` 发现计划，`show` 展开当前状态，`check` 与 `check-all` 检查单项或集合。
- Plan 查询提供 Git 基线后的提交数和目录外累计变化行数，帮助确定复核深度。
- 项目文档拥有稳定事实和行为，长期决策拥有跨 Change 的方向与理由；Change Plan 承接本次实施上下文。
- CLI 提供结构检查与删除保护，执行者负责工作证据与当前授权。只创建、查询或审阅计划时，即使
  发现全勾也保持原有操作范围；提交、清理故障与取消退出按各自执行路径处理。

Agent 从 [`SKILL.md`](../../skills/change-plan/SKILL.md) 进入；目录、metadata、模板、CLI 与恢复边界
由[固定契约](../../skills/change-plan/references/change-plan-contract.md)承接。
