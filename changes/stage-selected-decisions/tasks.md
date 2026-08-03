# Tasks

任务按“实施就绪审阅 → 共享 `pending` 写入 → 目标来源与 CLI → 文档和分发 → 证据与对齐”推进。Checkbox 只表示对应产物已实际完成，不表示整个 change 已获归档授权。

## Readiness

- [x] 0.1 核对 proposal、design 和 tasks 共同以“从 `revision` 基线叠加指定 `filesystem` 决策，形成完整 `pending` 决策快照”为目标，并确认生命周期文件事务没有被表述为暂存行为。
- [x] 0.2 核对 decision-records、共享版本管理层、持久索引、生成分发和测试证据 owner，确认领域代码只消费共享版本语义，当前仅支持 Git 也不向公共边界透传 Git 专属信息。
- [x] 0.3 完成独立 `stage <decision-path...>`、显式选择、未选择决策恢复 `revision`、范围外 `pending` 保留、领域目录表首版边界和可恢复失败语义的内容审阅，并确认 `Open Questions` 为“无”。

## Implementation

- [x] 1.1 建立 [共享版本管理写入决策](../../docs/decisions/version-control/manage-pending-snapshot-writes.md) 与 [指定决策暂存决策](../../docs/decisions/decision-records/stage-selected-decisions.md)，均保持 `active + unaligned`，且不在长期记录中保存本 change 的任务进度。
- [ ] 1.2 扩展共享版本管理公共类型与当前 Git 实现，提供字面路径范围的完整 `pending` 文件集合替换、范围外保留、输入校验、稳定错误映射、读回核对和可处理失败恢复；同步 `tools/shared/version-control.md` 的当前事实。
- [ ] 1.3 重构 decision-records 的索引来源读取，使 `filesystem` 同步与内存目标来源复用同一领域解析、投影、关系校验、`sourceRevision`、完整索引校验和确定性序列化路径。
- [ ] 1.4 实现独立 `stage <decision-path...>` CLI，包括参数校验、选择解释、目标来源构造、严格预写校验、共享 `pending` 范围替换、结果输出和退出状态；保持所有生命周期命令及其参数不变。
- [ ] 1.5 更新 `skills/decision-records/SKILL.md`、领域契约和 `docs/skills/decision-records.md`，让 agent 与人类都能恢复 `revision`、`filesystem`、`pending`、选择集、领域目录表边界和失败出口；提升 skill 版本。
- [ ] 1.6 从维护源码同步 decision-records 可分发 CLI、声明和 source map，确认共享版本管理实现继续由构建器内联，且没有新增跨 skill 运行时依赖。
- [ ] 1.7 完整实现并核对稳定事实 owner 后，将本 change 建立的两条长期决策标记为 `aligned`；若实现需要改变长期边界，先按决策演进规则建立修订记录。

## Verification

- [ ] 2.1 为共享版本管理层覆盖完整范围的增加、修改和删除，范围外 `pending` 保留，非法路径，无仓库或能力不可用，写入与读回失败，以及恢复成功与失败；确认公共结果不暴露 Git 专属值。
- [ ] 2.2 为 decision-records 覆盖 `filesystem` 并行 A/B、既有 `pending` B 后只选择 A、范围外 `pending` 保留、增加/修改/删除/重命名、完整索引与 `sourceRevision`、首次集合引导、候选或关系无效、领域依赖失败、重复或缺失路径、版本管理失败和生命周期回归。
- [ ] 2.3 为每个新增或修改的最小原生测试入口维护独立测试证据 case，并同步 `docs/test-evidence/test-evidence-index.json`。
- [ ] 2.4 运行 `bun run test:version-control`、`bun run test:decision-records-cli`、`bun run sync:decision-records-cli`、对应生成漂移检查、`bun run typecheck`、严格决策检查和 `bun run check`，只记录实际结果。
- [ ] 2.5 用代表性 agent 任务审阅更新后的行为文档，确认 AI 能区分 `filesystem` 生命周期事务与 `pending` 事务，推导选择集和范围排除，定位共享 owner 与失败出口，并准确说明“当前只需支持 Git，但公共边界不透传 Git”。
- [ ] 2.6 审阅最终 diff 与 `pending` 快照，确认 `git-commit-organizer` 行为未改变、生命周期命令没有 `--stage`、版本状态没有参与决策生命周期，且不存在候选决策、未同步生成物或未登记测试证据。
