# Design

本设计将全文发现彻底移出派生状态索引，同时保持 Index Runtime 作为稳定 ID、exact/range 结构过滤、排序和分页的共享协议。

## Context

- `tools/index-runtime/src/schemas.ts`、types、definition validation 与 query 目前将 `text` 作为固定 mode/filter；`query.ts` 私有实现 NFKC/小写/按词 contains。
- Investigation 在第一阶段迁移后不再是 text consumer；当前剩余消费者为 Test Evidence catalog 的 case `search` key/`list --query`，以及 Test Evidence ledger 的 `search` key/文本 query。二者都存储 `searchText` 派生正文副本。
- `adopt-tagged-test-evidence-cases` 正在把 topic 目录/metadata 改为平铺 case 与记录级 tags。它是本 Change 的硬前置，避免两个 Change 对同一来源布局和生成物竞争。
- 共享文件搜索协议与 Decision/Investigation adapter 已由 `establish-index-aware-file-text-search` 交付；若该 Change 未完成或其 API 不满足 Test Evidence 的受管 Markdown/ledger 输入，先恢复前置 Change，而不是在本 Change 重建第二套文本匹配。

## Goals / Non-Goals

目标：

- 把全体文本包含匹配、规范化与预览统一到文件搜索模块，令索引不再复制权威正文。
- 保持 Test Evidence catalog 与 ledger 的公开发现能力及其领域特有结果投影。
- 从 Index Runtime 完整删除 text 协议，留下最小 exact/range 公共查询面。

非目标：

- 不重新设计 Test Evidence 的 tags、目录、Case ID、ledger 关系或选择性暂存；这些由前置 Change 已经收敛。
- 不新增 regex、持久全文索引、相关性排序、跨领域 CLI 或 Index Runtime 的新字符串查询替代品。
- 不修改未受 text 退出影响的领域语义、测试入口或历史索引兼容策略。

## Decisions

### Intended Change

1. **串行门禁。** 实施 Readiness 必须首先确认 `adopt-tagged-test-evidence-cases` 已 complete/目录已退出，验证其提交中的最终 case root、tags、sourcePath、catalog/ledger APIs、分发产物和全量 check。若未满足，停止本 Change；不写 Test Evidence 文件，也不基于旧 topic 布局实现临时 adapter。
2. **Test Evidence 适配。** catalog 和 ledger 在 current index 可用时，分别从同一 reader snapshot 的 entries 构建 canonical `sourcePath → Case ID` 唯一 Map；索引不可用时才完整只读 fallback。结构过滤（最终 tags、test/relations 等）先产生显式 files，文本再走共享 file search。将命中映射回 Case ID 后，各自恢复原 API 的 Case/Test 投影、排序、offset/limit、warning/fallback 和诊断；对仅有实体 locator 而无 case Markdown 的 ledger 查询，保留明确的领域本地结构匹配，不伪称文件全文结果。
3. **公共模式退出。** Index Runtime 的 StateIndexKeyMode、key definition schema、filter union、definition validation、query evaluator、runtime overlay、README、导出类型、fixture 和测试只接受 exact/range；删除 private `normalizeText` 和 text-specific key/filter assertions，保留通用 ID 文本校验等无关概念。
4. **领域投影退出。** 从 Test Evidence catalog/ledger state、parsers、schemas、source revisions（若字段只服务正文副本）、key strategies、fixtures、queries与 API types 删除 `searchText` 和 `search` text key；删除 Investigation 残留 text key/schema fixture（若第一阶段留有兼容痕迹）。提升受影响 definitionVersion，利用现有 sync-index 重建而非兼容旧持久 index。
5. **契约与长期理由。** 更新 Test Evidence skill/catalog contract 查询说明、Index Runtime README、生成 schema/declaration 和 test-evidence cases。为 `use-fixed-index-query-modes` 建立后继决策，记录 exact/range 留在索引、全文改为按需权威文件搜索的理由与边界。

### Resulting Impacts

- **分页语义。** file search 必须先得出完整确定的 matched Case ID 集，再按 catalog/ledger 原有结构排序和 offset/limit 截断；不能先按文件枚举限额而改变旧查询的 total 或页边界。需要单独配置搜索内部 preview/scan 限额与 query 总量，超界时返回可行动诊断。
- **sourcePath 语义。** adapter 只使用前置 Change 定义的、相对 Test Evidence 受管集合 root 的权威 case `sourcePath`；共享模块返回同形路径，它不得从 Case ID、文件 basename 或 tag 反推位置。映射缺失/重复、陈旧索引、非法来源或漂移遵守领域 fallback/fail-closed 契约。
- **JSON/分发破坏面。** 删除 `text` 会改变 public runtime programmatic API 与持久 index schema；所有受影响 consumer 都要在同一提交/发布单元迁移并重建对应 bundles、source maps、Schema 与 `.d.mts`。不对旧 index 静默降级。
- **测试证据。** 新增或更新的查询/运行时测试必须按 Test Evidence owner 逐个登记，并同步派生索引；前置 Change 对其已迁移 case 的最终处理优先。

## Risks / Trade-offs

- Test Evidence 同时有 catalog 与 ledger，二者 source authority 和结果层次不同；只迁移明显的 catalog 查询会留下 ledger text key，导致通用删除不完整。
- 依赖 completed Change 的实际字段而非当前 draft 能避免错误设计，但需要在实施开始时重新审阅，不能把本计划的布局假设当事实。
- 退出 text mode 后，外部直接 import Index Runtime 的未发现用户会收到明确 schema/API 失败；这是有意非兼容演进，需用 definition version、文档和测试明确边界。

## Open Questions

无。串行前置是执行条件而非待用户选择的问题；若前置 Change 的最终公开查询需求与本 design 冲突，应先创建其后继 Plan 或更新本 Plan，并重新运行 `plan`，不得在实施中暗自扩展范围。
