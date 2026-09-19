# Design

以单一概念模型贯穿文档、公开接口和验证材料，让每个术语只承担一层含义。

## Context

- Change Plan 只保存 `draft` 与 `plan` 两种 stage；最终动作成功后目录不存在，历史由 Git 恢复。
- 当前 `complete` 同时接近 task 进度、语义完成和生命周期动作，公开表述容易失去指代对象。
- 现有删除事务已经提供 Plan、task、Git tree、tombstone、重验和恢复门禁，本 Change 只调整其领域名称和公开表面。
- CLI 与 JSON 是固定公开契约；直接 import 表面虽不承诺稳定，仍需与当前实现同步。

## Goals / Non-Goals

- 建立能在中文说明、CLI、API、结果和证据中一致使用的专用动作名称。
- 保持 Draft/Plan 结构、任务进度、Git 距离和删除安全契约不变。
- 将 OpenSpec archive、历史记录和删除实现留在各自 owner，不纳入当前术语迁移。

## Decisions

### Intended Change

术语与责任固定如下：

| 概念 | 当前表达 | 责任 |
| --- | --- | --- |
| Plan 内进度 | task completion、`completedTaskCount` | 记录 checkbox 事实 |
| 语义验收 | Outcome、Success Criteria、owner 交接 | 判断 Plan 是否具备结项条件 |
| 生命周期动作 | 结项、`finalize` | 让合格 Plan 退出活动名称空间 |
| 文件系统效果 | 删除、`change-deletion-*` | 安全删除目录并提供恢复边界 |

1. 生命周期写作 `draft -> plan --finalize--> directory absent`；`finalize` 是动作，不是 metadata、stage 或历史容器。
2. 公开 CLI 使用 `finalize`，直接 import 表面使用 `finalizeChangePlanDirectory`、`ChangePlanFinalizeResult` 等名称，成功 outcome 使用 `finalized`。
3. 公开命令集合只接受 `finalize`。旧动作词通过既有 usage error 暴露调用方迁移需求，不建立 alias。
4. `completedTaskCount`、`committed-cleanup-pending` 和 `change-deletion-*` 保持原名，因为它们分别描述进度、事务状态和删除责任。
5. 新的 finalization 决策修订并承接 `260904-current-change-plan-completion`；当前测试与 Gate 身份采用 finalize，归档历史保持原文。

### Resulting Impacts

- 行为文档需要先定义概念映射，再描述授权、门禁和删除效果，避免读者从局部文本恢复出 finalized 状态。
- CLI、JSON、直接 import、测试和 generated runtime 构成同一次契约迁移，不能分批留下相互冲突的表面。
- Gate Check 改名会使旧增量 receipt 失配，并由新身份重新形成证明。
- Test Evidence 需要重审受影响 Case 的身份、Contract、Proves 和真实 Tests token，再重建索引。
- skill 行为与公开契约变化由独立版本和新的长期决策承接。

## Risks / Trade-offs

- `finalize` 本身不说明删除效果，因此定义和帮助文本必须同时给出 `directory absent` 结果。
- 硬切命令会中断仍调用 `complete` 的脚本；显式 usage error 和版本提升用于暴露迁移，而不是隐藏差异。
- 机械替换可能误伤 task completion、删除实现或历史内容；实施时按上表的责任分类处理每个命中。

## Open Questions

无。若实施前改变专用词或兼容策略，先同步本 Change 的 Outcome、决策和验收标准。
