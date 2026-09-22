# Tasks

任务先确认状态与 owner，再实现共同运行时行为，最后用目标回归和完整仓库门禁证明结果。

Readiness 复核项是本 Change 的实施前审计门禁；未勾选的前置项未满足前，不得开始对应实施任务。

## Readiness

- [x] 0.1 对照两个领域的查询、同步、mutation 和现有测试，形成“操作类别 → 数据源 → 新鲜度门禁 → 诊断”的实现清单。
- [x] 0.2 确认现有 `tools/index-runtime/` 诊断是否足够；将领域映射与确需共享的最小改动边界记录到 design 的 Resulting Impacts 中。
- [x] 0.3 查找适用的长期 Decision，确定新增还是演进，并确认相关 Test Evidence Case 与最小原生测试入口。
- [x] 0.4 确认 `unify-record-cli-location-and-help` 已完成，并按其最终 parser、location、普通参数错误与 help renderer 复核本 Plan。

## Implementation

- [x] 1.1 在 Decision Records 中实现索引型发现、单实体读取和内容搜索的目标陈旧行为与结构化诊断。
- [x] 1.2 在 Investigation Report 中实现相同的查询分类、结果边界和诊断语义。
- [x] 1.3 统一两个领域的 `sync-index` 默认写入、`--select` 完整发布和 `--preflight` 零写入契约，移除 `--write` 公共语法且不保留兼容或迁移特判。
- [x] 1.4 为严格检查、发布、关系与生命周期 mutation、删除和 staging 提供同一新鲜度门禁与恢复动作；后续新增动作只接入该门禁，不复制陈旧状态判断。
- [x] 1.5 仅在 readiness 证明必要时扩展 `tools/index-runtime/`，并保持领域恢复文案由各领域拥有。
- [x] 1.6 更新两个 skill、对应人类入口和长期 Decision，使维护顺序、数据源边界和完成证据与运行时一致。
- [x] 1.7 新增或调整查询、同步、门禁和诊断测试，并同步受影响的 Test Evidence Case 与索引。
- [x] 1.8 提升受影响 skill 版本并通过 `sync:decision-records-cli`、`sync:investigation-report-check` 更新分发制品。

## Verification

- [x] 2.1 运行 Decision Records、Investigation Report 和按需的 index-runtime 目标测试，覆盖陈旧快照、实体身份、来源投影、同步预演、mutation 阻断和旧 `--write` 的普通无效参数结果。
- [x] 2.2 在隔离测试集合执行正文追加、索引定义变化和非法来源的代表性 A/B，核对 warning、error、零写入和恢复命令。
- [x] 2.3 运行两个生成漂移检查、`typecheck`、`lint`、`check:decisions`、`check:investigations` 与 Test Evidence 检查。
- [x] 2.4 运行 `bun run check`，并审阅 skill 版本、生成物和长期 owner 没有遗留不一致。
