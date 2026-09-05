# Proposal

本 Change 在 Test Evidence 完成其标签化/布局演进并迁移全部实际消费者后，删除 Index Runtime 的派生 text 查询模式。

## Why

Index Runtime 的 text mode 只能检索写入派生索引的文本副本，无法提供权威 Markdown 的行预览，也使不同领域重复维护 `searchText`。第一阶段已经为 Decision/Investigation 建立文件搜索；但 Test Evidence catalog 和 ledger 仍直接使用 text key，因此立即删除会破坏公开查询能力。

## Outcome

在 `adopt-tagged-test-evidence-cases` 完成并稳定 Test Evidence 权威布局后，catalog 与 ledger 的全部文本查询改由统一文件搜索和领域 sourcePath/Case ID 映射实现，Index Runtime 仅保留 exact 与 range 结构查询，且不再持久化 text key 或 `searchText` 正文副本。

## Scope

### Intended Change

- 以已完成的 `adopt-tagged-test-evidence-cases` 为串行前置，按其最终 Test Evidence case/tags/sourcePath 契约接入文件搜索。
- 迁移 Test Evidence catalog 的 `list --query`、程序化查询和 ledger 的实际 text 查询消费者，同时保持各自公开命令形状、结构过滤和分页契约。
- 删除 Index Runtime text key/filter/type/schema/实现/测试，并从 Investigation/Test Evidence index definition、state、schema、fixture 和生成物清除 text projection。
- 演进固定索引查询模式的长期决策，并更新 Test Evidence skill/contract、测试证据与分发产物。

### Resulting Impacts

- 本 Change 不得在前置 Change 尚为 draft/plan 或其最终布局未验证时开始迁移；两 Change 不并行修改 Test Evidence 的目录、sourcePath、tags、schema、CLI 或生成物。
- catalog 与 ledger 必须各自把文件搜索命中映射回完整 Case ID，再按原本的领域投影、过滤、排序和分页输出；不能因共享模块而合并两套 CLI 或改变 case/ledger 身份。
- 删除通用 text mode 是破坏性协议演进：全部 StateIndexDefinition consumers、runtime overlay、JSON schema/types、reader/query diagnostics、fixtures、performance/protocol/query tests 都必须证明不再接受或声明 `text`。
- text 副本退出后，持久索引 definition version 和领域 JSON Schema/生成物会改变；旧索引需要由已有同步入口重建，不能自动兼容或静默解释。

## Success Criteria

- 前置 Change 已完成且其 Test Evidence directory/check、tags、sourcePath、Case ID 和生成物基线可核对；本 Change 的起始审计记录该 revision/契约。
- catalog `list --query` 与 ledger 的文本 query 都在权威受管文件中返回正确 Case ID/领域投影，并保留其指定结构筛选、排序、分页、fallback 与诊断边界。
- 所有 StateIndexDefinition 只声明 exact/range；Index Runtime 拒绝 `text` key/filter，持久 indexes 不再含 `searchText` 或 text keys，且重建后的索引/Schema/生成物一致。
- Test Evidence、Index Runtime、Decision、Investigation 及仓库检查通过；长期决策和 skill 文档没有继续宣称 text 是 Index Runtime query mode。

## Affected Owners

- `changes/adopt-tagged-test-evidence-cases/` 仅作为完成前置，绝不在本 Change 中修改。
- `tools/shared/src/file-text-search/` 的已建立协议与 `tools/test-evidence/` catalog/ledger adapters。
- `tools/index-runtime/` schema、types、definition validation、query、runtime overlay、README、fixtures/测试。
- `skills/test-evidence-review/`、`skills/investigation-report/`、对应 build/generated artifacts、schemas 与 test-evidence owner。
- `docs/decisions/use-fixed-index-query-modes.md` 的后继演进记录。
