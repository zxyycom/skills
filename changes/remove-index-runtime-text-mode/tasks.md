# Tasks

任务严格串行：先取得完成后的 Test Evidence 字段与公开查询基线，再分别迁移 metadata、content 和 entity 查询，最后删除公共 text 协议。

## Readiness
- [ ] 0.1 确认 `changes/adopt-tagged-test-evidence-cases/` 与 `changes/add-index-only-metadata-search/` 均已 Change Plan complete 并退出；记录两个完成 revision。审阅前者最终 Case 布局、tags、sourcePath、Case ID、catalog/ledger source authority、索引 state/key/schema、public CLI/API、fixture、生成物与测试证据，以及后者共享纯 segment matcher 的稳定导入契约、分发入口和测试，建立可复现基线。
- [ ] 0.2 对 catalog Case query、ledger Case query 与 ledger Test entity query 完成实际调用面清单：记录当前 `searchText` / text-key 来源、结构 filter、query 词法、排序、total、offset/limit、warning/fallback、JSON/CLI 输出和外部 API。
- [ ] 0.3 从完成后的字段事实写出查询范围与兼容矩阵：逐入口指定 metadata 白名单及 field owner、content Markdown source、entity-local 字段、all/any/phrase、`matchedFields`/行预览输出、未限定旧 query 的保留或显式版本化演进；Contract/Proves 未有命名投影时明确归 content。若矩阵改变本 Plan，先修订并重新 `plan`。
- [ ] 0.4 从已完成的 `add-index-only-metadata-search` 验证共享纯 segment matcher 的稳定导入、all/any/phrase、规范化、行号/预览和测试覆盖；Test Evidence 只复用该契约，不复制 matcher、持久索引或领域 DTO。
- [ ] 0.5 为 catalog 与 ledger 准备覆盖矩阵的受管 Markdown、snapshot、损坏/定义不匹配的持久 snapshot、发布后实体修改、重复/非法 sourcePath、映射漂移、分页和 entity-local fixtures；登记本次新增或修改的最小原生测试入口所需的 Test Evidence case。

## Implementation
- [ ] 1.1 依据最终前置字段，为 catalog 和 ledger state/source/schema 建立仅含正式可归因字段的 metadata 投影和 exact/range key；删除其中只服务 `searchText` 的 state、source 或 schema 内容，但不把 Contract/Proves 为搜索重新拼接或假定其已投影。
- [ ] 1.2 实现 catalog Case metadata adapter：一次成功加载的持久索引 snapshot 上先执行结构筛选、再逐字段匹配并投影 `matchedFields`；索引任何不可用状态直接返回 sync/check 诊断，不读取 Case Markdown、source revision 或建立内存 fallback。
- [ ] 1.3 实现 ledger Case metadata adapter，并保持其 tags/testIds 等最终正式字段、Case ID、结果 DTO、结构条件和诊断 owner；metadata 失败语义与 catalog 同为纯持久索引、无实体或 source revision fallback。
- [ ] 1.4 实现 catalog Case content adapter：从相同 snapshot 的最终 `sourcePath` 构建唯一 Case ID 映射，限制 file-text-search 至结构筛选后的受管文件，返回行号、预览和 Case ID；处理映射/文件/限额失败，不从路径名或文件扫描反推身份。
- [ ] 1.5 实现 ledger Case content adapter，保持 ledger 的 Case source authority、relation/test 条件、领域投影、确定排序、total 与 offset/limit；ledger Test entity ID/name/locator query 保持明确本地匹配，不接入 Case Markdown 或 Case `searchText`。
- [ ] 1.6 按范围矩阵演进 catalog/ledger CLI 和程序化 query：保留既有公开查询语义，或实现已声明的 scope/版本化迁移诊断；在完整匹配 Case ID 集上再进行领域排序和分页，不能先分页文件或将 metadata/content 静默混合。
- [ ] 1.7 在所有实际 consumer 迁移后，删除 catalog 与 ledger 的 `searchText` / `search` text key，以及 Index Runtime 的 text mode/filter/definition validation/query evaluator/runtime overlay/types/README/fixtures/tests；仅保留 `exact` 与 `range`，并提升必要 definition/schema version 与旧索引重建诊断。
- [ ] 1.8 更新 Test Evidence 与 Index Runtime 的长期契约/skill 指导、`use-fixed-index-query-modes` 后继决策、API declarations、JSON schemas、bundles、source maps 与测试证据账本；明确 snapshot metadata、权威 content 与重建边界。

## Verification
- [ ] 2.1 对 catalog 和 ledger 运行 metadata fixture/API/CLI 测试，证明字段白名单、all/any/phrase、`matchedFields`、结构过滤、排序、total/分页和持久索引异常失败；用读取监测或等价证据证明 metadata 路径不打开 Case Markdown 或 source revision、不 fallback、不写入 `searchText`，且发布后实体修改不会被误表述为 snapshot 元数据。
- [ ] 2.2 对 catalog 和 ledger 运行 content fixture/API/CLI 测试，证明只搜索受管权威 Markdown、同 snapshot `sourcePath → Case ID` 映射、物理行号、预览、映射/来源诊断和完整集合后分页；验证 entity-local query 未被误变成全文搜索。
- [ ] 2.3 运行 Index Runtime protocol/query/runtime/overlay/schema 测试，证明 exact/range 不变、text definition/key/filter 被严格拒绝；扫描 workspace consumer、persisted fixtures 和生成物，确认不再有 `mode: "text"`、`kind: "text"` 或仅用于索引搜索的 `searchText`。
- [ ] 2.4 通过全量 sync 重建最终 Test Evidence 索引，验证 definition/schema/source revision、selected sync/stage、旧索引的明确重建诊断和分发生成物；运行 `bun run test:index-runtime`、`bun run test:test-evidence-cli`、相关 Decision 测试、Investigation 的既有 exact/range 回归测试及受影响 build/schema checks。
- [ ] 2.5 运行 `bun run check`，人工复核查询范围矩阵、兼容迁移、长期决策、skill 指导、生成物和 Test Evidence 账本；确认没有修改两个硬前置 Change，并确认共享 matcher 只通过 `add-index-only-metadata-search` 已验证的稳定导入契约使用。
