# Design

本设计暂定保留 Case ID，把文件名唯一性、平铺存储和记录级 tags 作为独立于测试语义身份的分类与定位改造。

## Context

- [`fix-test-evidence-workspace-contract`](../../docs/decisions/fix-test-evidence-workspace-contract.md) 当前固定了测试证据根目录、受控 topic catalog、topic 目录和统一派生索引；本 Change 必须通过后继决策演进该契约。
- [`stage-selected-test-evidence-index-entries`](../../docs/decisions/stage-selected-test-evidence-index-entries.md) 已经让选择性暂存按 Case ID 选择条目。Case ID 因而应继续作为测试证据的语义身份，而不是被文件路径或 tag 替代。
- 本 Change、已归档的 [`adopt-tagged-decision-records`](../archive/adopt-tagged-decision-records/design.md) 与 [`adopt-tagged-investigation-topics`](../adopt-tagged-investigation-topics/design.md) 源自同一组 draft，并暂用同一工作定义：目标资源文件是 274 条 Decision Records、12 个 Investigation Report topic（不含 `_resources/`）和 493 个 Test Evidence case，共 779 个权威 Markdown；“全局文件名唯一”指这些文件的 basename（含 `.md`）在合并集合中不重复，不包含派生索引、说明文件和调查附件。大小写与 Unicode 规范化规则仍待确定，这一定义也不是长期 owner。
- 当前 493 个 case 中存在合并集合内唯一一组同名文件：`docs/test-evidence/test-evidence/stage-index-applies-selected-additions-deletions-and-explicit-renames.md` 与 `docs/test-evidence/investigation-report/stage-index-applies-selected-additions-deletions-and-explicit-renames.md`。两者都是 Test Evidence case，只是位于不同 topic；平铺和全局门禁启用前必须重命名其中一个文件，但 Case ID 保持不变。
- 当前 topic catalog 提供分类元数据，topic 目录提供物理分组；topic catalog 的集合级变化会妨碍只按 Case ID 选择单个 index entry 的纯局部暂存。
- [`skills/test-evidence-review/SKILL.md`](../../skills/test-evidence-review/SKILL.md) 要求每个文件只保存一个 case，并让账本覆盖全部可独立选择和报告的最小原生测试入口。标签化不能削弱这一完整性门禁。
- Test Evidence 没有活动/归档生命周期。本 Change 只与另外两个 Change 共享 tag/query 和全局文件名约束，不共享 Decision Records 的归档 locator 或关系生命周期。三个 Change 暂定按 Decision Records、Investigation Report、Test Evidence 的顺序推进，并在进入任一 Plan 前先确认共同契约；本 Change 完成迁移后启用最终全局门禁。

## Goals / Non-Goals

目标：

- 将 493 个 case Markdown 从 topic 子目录迁移到明确的平铺布局，并要求资源文件名在三个集合中全局唯一。
- 在每个 case 的权威元数据中保存多个 tags，由派生索引直接投影并支持组合查询。
- 保留 Case ID 作为 index key、测试关联和选择性暂存目标，使文件重命名或移动不会被误解成 Case ID 变化。
- 移除 topic catalog、topic 路径和集合级分类 metadata 对 case 维护及暂存的耦合。
- 保留对最小原生测试入口、`proves`、去重、账本覆盖、确定性索引和单 case 文件的全部现有校验。
- 迁移唯一一组已知文件名冲突，并建立能阻止三个集合再次出现冲突的统一门禁。

非目标：

- 不改变 Case ID 的语义、生成策略或引用方式，也不强制 Case ID 与文件名相同。
- 不改变测试框架、测试发现方式、原生入口定义、`proves` 关系或如何判断证据充分性。
- 不为 Test Evidence 增加活动/归档位置、归档命令或跨状态索引。
- 不在本 Change 中改造 Decision Records、Investigation Report 或建立通用资源平台。
- 不在 draft 阶段批量移动 493 个文件、重命名冲突文件、删除 catalog 或重建索引。

## Decisions

当前责任拆分如下；“暂定”项必须在进入 Plan 前由开放问题收敛：

| 责任 | 当前设计方向 | 判断状态 |
| --- | --- | --- |
| 语义身份 | Case ID 继续作为索引键、测试关联、`proves` 和 `stage-index` 的选择目标 | 已确认 |
| 文件命名 | basename 与 Case ID 解耦，并服从 779 个目标资源文件的合并集合唯一性门禁 | 已确认方向，规范化与冲突新名称待定 |
| 分类 | tags 写入每个 case 的权威元数据，topic catalog 与 `metadata.topics` 退出权威结构 | 已确认方向，字段与迁移映射待定 |
| 存放与定位 | case 平铺在一个不表达分类的固定源文件区域，索引保存 Case ID 与 `sourcePath` | 已确认方向，根目录或固定容器待定 |
| 选择性暂存 | 继续按 Case ID 构造完整目标索引，不单独暂存 tag catalog | 已确认方向 |
| 专属语义 | 原生测试入口、`proves`、账本覆盖和单 case 文件校验保持不变 | 已确认边界 |
| 生命周期 | Test Evidence 不增加活动/归档状态或归档命令 | 已确认边界 |

- **查询由 topic 迁移到 tag。** list、find 和 check 等入口使用共同的 tag token 与组合语义，同时保留 Case ID、entry、`proves`、文件路径和全文等专属条件。
- **重命名只迁移文件定位。** 已知冲突通过重命名其中一个文件解决，Case ID 和测试入口保持不变；所有路径引用、索引 `sourcePath` 和文档链接随迁移更新。
- **全局门禁是本组三个 Change 的最终验收。** 门禁只扫描共同工作定义中的 779 个权威 Markdown，并为每个冲突报告全部路径；它不要求统一资源索引。
- **topic 只作为迁移输入。** 现有 topic 是否转换成初始 tag 需要按 case 内容和 topic 描述审阅，迁移完成后不保留 catalog 与 case tags 两个分类事实来源。

## Risks / Trade-offs

- 493 个 case 的机械迁移面大，容易遗漏索引、fixture、文档链接或脚本路径。实施应使用确定性迁移与新旧集合对账，而不是依靠逐文件手工移动。
- Case ID 与文件名刻意解耦能保留既有测试语义，但维护者需要理解两个名称的不同责任。文档和诊断应始终同时显示 Case ID 与 source path，避免误把文件名当成关联键。
- 移除受控 topic catalog 会消除集中冲突，也失去 topic 描述这类集合级说明。若其中存在仍有价值的语义，需要迁入 tag 文档或其他现有 owner，而不能静默丢弃，也不能借机创建全量 tag 注册表。
- 根目录平铺 493 个文件可能降低人工浏览体验。索引与查询可解决检索效率，但是否使用一个固定非分类容器会影响导航、发现规则和链接迁移，需要在 Plan 前用实际文件结构比较。
- 全局文件名门禁只有在三个集合的权威文件边界都明确后才可靠；过早扫描索引、说明或附件会产生误报，过晚启用又可能在并行迁移中引入新冲突。
- 自由 tags 可能产生拼写漂移；受控 topic 则会重新引入集中重组成本。暂定接受最小语法规范与可查询诊断，按真实重复再治理语义别名。

## Open Questions

1. **[共享]** basename 唯一性是否按大小写折叠和 Unicode 规范化比较，tag token、排序及多 tag AND/OR 语义是什么？
2. **[共享]** 全局文件名门禁与最小 tag/query 契约由哪个现有项目级 owner 承接？
3. **[Test Evidence]** 493 个 case 直接平铺在 `docs/test-evidence/`，还是放入固定、非分类且不参与身份的源文件容器？
4. **[Test Evidence]** tags 字段是否必填或允许空集合，写入 case Markdown 的哪个权威元数据位置？
5. **[Test Evidence]** 现有 topic 转成同名初始 tag 还是按 case 内容重新审阅，topic 描述中的有效语义由谁承接？
6. **[Test Evidence]** 已知冲突重命名哪一个文件、采用什么 basename，才能保持语义清楚且不改变 Case ID？
7. **[Test Evidence]** 旧 topic catalog、`--topic` 和 topic 路径输入采用一次性移除还是有退出门禁的短期兼容？
8. **[Test Evidence]** 平铺迁移如何对账 493 个 case、Case ID、原生测试入口与 `proves`，证明没有丢失、重复或错误重绑？
