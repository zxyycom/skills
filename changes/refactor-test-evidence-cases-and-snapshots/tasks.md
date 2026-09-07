# Tasks

按 Implementation 的顺序落实 [design](design.md)，再以 Verification 验收 [proposal](proposal.md) 的 S1–S8。Readiness 只证明计划可执行，不表示实现或产品验证完成。Readiness 完成后从 1.1 开始；准备阶段使用隔离 fixture，正式目录与公开门面在 1.7 同批切换。

## Readiness

- [x] 0.1 审计当前公开 catalog、内部 ledger、Index Runtime、构建和项目 Gate 的入口及 owner；确认 D1–D6 的复用/移除范围，没有平行实现或隐含外部项目修改。
- [x] 0.2 审计用户边界、JSON/expected source、Case-only 索引与查询语义；确认无 Topic、Case 关系、证明点映射或核心采集回调，公开字段与失败结果没有待用户选择项。
- [x] 0.3 审计项目注册路径：隔离参数矩阵和 Node 专用文件探测支持 D5；确认全 skipped、输入绑定、注册副作用和真实测试执行的界限。
- [x] 0.4 按 ai-ready-docs 复核 D1–D6/I1–I3；用无快照查询、陈旧快照、测试拆合、旧 Case 迁移四个场景恢复正确路径，删除非现行选择和空占位描述。恢复结果分别为 D3 的独立查询、D2 的阻断而非缺失引用、D1 的保留意图并重审引用、I1 的精确匹配与歧义拒绝。
- [x] 0.5 审计三份 artifact 的范围/依赖/验收一致性，通过 change-plan、链接和仓库检查；确认最终提交快照可直接进入 1.1，无须用户补充设计决定。

## Implementation

- [ ] 1.1 按 D1/D2/D4 定义 Case、实体快照、引用结果与公开选项的 Valibot Schema/类型，补齐严格解析、身份与输入选择边界。
- [ ] 1.2 从 ledger 解耦 Case-only source、索引 definition v6 与引用检查；完成 D2 状态分支，移除实体快照进入索引/查询和强制反向覆盖的路径。
- [ ] 1.3 实现 D3 的 list/tags/show/search、来源标识、分页与资源边界，复用 Index Runtime 和文件搜索；保留同步及 selected staging 的现有安全语义。
- [ ] 1.4 将 D4 接到唯一公开 CLI/API，更新源码测试、公共声明和构建适配；准备新分发制品供 1.7 切换，保持导入无副作用，移除旧 topics/--topic/list --query 导出。
- [ ] 1.5 实现 D5 的项目 snapshot/check 及受限命令解析、Bun JUnit、unsupported 注册形状检查、source 前后指纹与独占输出；锁定项目本地 ast-grep/XML 依赖并同步安装许可、环境诊断和 CI 版本检查；添加 snapshot:test-evidence、test:test-evidence-project 及项目测试证据。
- [ ] 1.6 实现 I1 的 migrate:test-evidence 预演/写入、独立转换验证、Entry 到真实实体匹配、冲突拒绝与恢复；为迁移安全边界建立 fixture 测试。
- [ ] 1.7 在同一切换批次迁移主仓库 Case/索引、更新 repository-catalog 测试与根 Schema/Gate mapping，将 check:test-evidence-catalog 接到项目 wrapper；保留项目全测试登记要求，删除旧 Topic 源和不再使用的 catalog runtime。
- [ ] 1.8 按 I2 更新 skill、references、AGENTS、navigation、tooling、人类说明与相关 Decision，提升 skill 版本并重新生成完整制品；复核受影响 Case、索引及旧生成物清理范围。

## Verification

- [ ] 2.1 V1 / S1–S2：验证独立 Case、可选 tags、一 Case 多实体、一实体多 Case、重复 ID/引用、空字段、文件移动与路径/硬链接安全；证明点没有独立映射。
- [ ] 2.2 V2 / S4–S5：验证 JSON 版本/UTF-8/类型/大小/重复实体、complete/partial、expected source 不匹配、未知 Case 选择、空集合、缺失引用和未引用实体合法；每种失败的 state、诊断和退出行为一致。
- [ ] 2.3 V3 / S3–S5：在实体 JSON 缺失、损坏、替换时复跑 Case 查询/同步；验证它们不读快照、不执行测试/采集命令、项目回调或网络；查询及引用检查零进程，同步/暂存只允许既有 Git 能力，不把索引或引用有效当作测试通过。
- [ ] 2.4 V4 / S3：验证 list/tags 的持久快照标识、show 身份/指纹核对、search 当前性/全文/资源限额，以及坏索引、陈旧索引、重建、并发漂移和全部 source revision 分支。
- [ ] 2.5 V5 / S3：以 1,000/10,000 个生成 Case 验证 ID/tag/test 筛选、AND、排序、分页和读取次数；list/tags 零 Case/实体读取，show 单 Case 读取，正文仅在搜索或完整检查时进入。
- [ ] 2.6 V6 / S7：演练合法旧目录迁移、Case ID/原文保留、Entry 零/多匹配、冲突/并发/恢复、旧格式拒绝、selected sync/stage 与首次 definition 切换的整体暂存；不丢弃无关数据或手改索引。
- [ ] 2.7 V7 / S6：运行项目生产器测试、完整注册和本项目引用/覆盖检查，覆盖动态参数名、Node 专用声明、重复容器、unsupported 形状、坏/空报告、XML 外部实体拒绝、依赖缺失/版本错误、非零退出、采集中源变化与输出冲突；区分注册和实际测试结果。
- [ ] 2.8 V8 / S8：运行 bun run test:test-evidence-cli、bun run test:test-evidence-project、bun run check:test-evidence-cli、bun run check:test-evidence-catalog、bun run validate-skill -- skills/test-evidence-review 与 bun run check；分发 Node smoke、文档阅读路径、Decision 对齐及全部变更测试证据通过后再勾选。
