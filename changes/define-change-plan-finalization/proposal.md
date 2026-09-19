# Proposal

为 Change Plan 定义“结项（`finalize`）”这一专用生命周期动作，明确区分任务进度、语义验收和目录删除。

## Why

Change Plan 完成后已不再保存归档目录，而是删除当前目录并由 Git 提供恢复历史，因此 `archive` 不再描述实际行为。现行 `complete` 又可同时表示 task 已勾选、成功标准已满足和最终删除动作，无法准确指向其中任何一层。

本 Change 为最终动作建立独立术语，并让删除继续作为该动作的可观察效果，而不是生命周期名称。

## Outcome

维护者和 agent 能一致识别“结项（`finalize`）”是已完成 Plan 退出活动名称空间的专用动作，其成功效果是删除目录且不产生持久终态；任务完成和语义验收继续表达各自事实。

## Scope

### Intended Change

- 以“结项（`finalize`）”命名最终生命周期动作，使用 `draft -> plan --finalize--> directory absent` 表达状态变化。
- 将公开 CLI、直接 import 表面、结果类型和成功 outcome 统一为 finalize/finalized 术语；公开命令集合只保留 `finalize`。
- 保持任务进度字段和内部 deletion 模块的现有含义，使“完成”只描述进度或验收，“删除”只描述文件系统效果。

### Resulting Impacts

- 同步 Change Plan 的行为 owner、人类入口、agent 提示和仓库概览。
- 重命名 CLI 领域包装、公开导出、帮助、诊断、JSON outcome、测试入口和生成制品。
- 更新相关 Vibe Gate Check、测试证据 Case 和派生索引。
- 以新的 finalization 决策承接当前 active completion 决策，同时保留历史记录原文。

## Success Criteria

- 当前 owner 用 `finalize` 唯一指代最终动作，并在首次出现时说明其成功效果是删除目录。
- CLI 提供 `finalize <change-directory> [--preflight] [--json]`；`complete`、`archive` 和旧 archived 选项作为未知接口被拒绝。
- 任务进度、删除准备、tombstone、Git 恢复和并发保护契约保持原有语义。
- 决策、生成制品、Gate Check、测试与证据账本同步，并通过目标检查和项目门禁。

## Affected Owners

- `skills/change-plan/`、`docs/skills/change-plan.md`、`AGENTS.md` 与 Change Plan 的分发版本。
- `tools/change-plan/`、`scripts/build/change-plan.ts` 及生成的 `skills/change-plan/scripts/change-plan.mjs*`。
- Vibe Gate 的 Change Plan Check 定义、fixture 与 impact 验证。
- `docs/decisions/` 中当前 Change Plan 生命周期决策及其索引。
- `docs/test-evidence/` 中受影响的 Case、测试实体引用与索引。
