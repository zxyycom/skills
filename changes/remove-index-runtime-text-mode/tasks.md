# Tasks

任务以 Test Evidence 迁移完成为硬门禁；随后先完整迁移两个实际消费者，再删除公共 text 协议并验证重建与分发。

## Readiness
- [ ] 0.1 确认 `changes/adopt-tagged-test-evidence-cases/` 已按 Change Plan complete 退出，并在其完成 revision 审阅最终 case 布局、tags/sourcePath、catalog/ledger public API、索引 schema、测试证据与生成物；记录本 Change 的可复现基线。
- [ ] 0.2 确认 `establish-index-aware-file-text-search` 已完成、其 `tools/shared/src/file-text-search/` 模块、显式 file list/pattern、all/any/phrase（phrase 单行）、preview/limit 和同快照 sourcePath mapping API 可由 Test Evidence CLI build 内联；缺失时停止并先完成前置 Change。
- [ ] 0.3 全面列举 text mode 表面与消费者：Index Runtime schema/types/definition/query/runtime/tests/README；Test Evidence catalog `list --query`、ledger case query、ledger entity-local query、`searchText`、schemas/fixtures/API；以及 Investigation 的已迁移残留。
- [ ] 0.4 为 catalog 和 ledger 分别制定旧查询行为基线（query 词法、结构筛选、排序、total、offset/limit、warning/fallback/diagnostics）和覆盖它的受管 Markdown fixtures，区分可由文件命中恢复与仅实体 locator 的本地匹配。

## Implementation
- [ ] 1.1 按前置 Test Evidence 最终 sourcePath 契约实现 catalog adapter：从同一 index snapshot entries 构建唯一 sourcePath Map、index-first 显式 file list/结构筛选、只读 fallback、shared file-search 命中到唯一 Case ID、再按原 list 结果 DTO、排序和分页投影；保持 `list --query` 的公开命令形状。
- [ ] 1.2 按 ledger 的独立来源与实体模型实现 adapter：迁移其 Case 文本查询到 shared file-search/Case ID 映射，保留非 case entity locator 查询的明确本地职责，并删除 ledger `searchText`/text key。
- [ ] 1.3 删除 catalog 的 `searchText`/text key/filter 依赖，更新 index definition version、state/source/schema/API、fixtures和 sync/read fallback；确认选择性 sync/stage 继续只按 Case ID 运作。
- [ ] 1.4 在所有领域消费者完成后，从 Index Runtime 删除 text key mode/filter、验证、执行器、overlay 路径、导出类型、README、fixtures与测试，只保留 exact/range，并调整定义/持久 schema 的严格解析。
- [ ] 1.5 清理 Investigation 的剩余 text 协议痕迹，更新 Test Evidence/Index Runtime skill contracts、维护说明和 `use-fixed-index-query-modes` 的后继决策，明确不兼容重建与文件全文搜索边界。
- [ ] 1.6 重建全部受影响 skill bundles、source maps、JSON schemas 与 declaration artifacts；按 Test Evidence owner 为新增/修改测试逐案维护 case 并同步索引。

## Verification
- [ ] 2.1 运行 catalog 与 ledger 的端到端/fixture 测试，证明文本查询仍能正确返回 Case ID、领域投影、结构过滤、确定排序、total/分页、fallback/warning 与受限预览，不读取未受管文件。
- [ ] 2.2 运行 Index Runtime protocol/query/runtime/overlay tests，证明 exact/range 行为不变且 text key/filter/definition 被严格拒绝；扫描全部 workspace consumer 确认不存在 `mode: "text"`、`kind: "text"` 或仅为索引搜索保留的 `searchText`。
- [ ] 2.3 通过全量 sync 重建 Decision、Investigation 与最终 Test Evidence 索引，验证 definition version、schema、source revision、selected sync/stage 和旧索引的明确重建诊断。
- [ ] 2.4 运行 `bun run test:index-runtime`、`bun run test:test-evidence-cli`、`bun run test:investigation-report-check`、相关 Decision 测试和所有受影响 build/schema check。
- [ ] 2.5 运行 `bun run check`，人工复核后继决策、skill 查询指导、生成物和测试证据账本；确认没有在本 Change 中改写或复活前置 Change 的所有权范围。
