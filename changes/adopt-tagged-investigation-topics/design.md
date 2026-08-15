# Design

本设计暂定移除 Investigation Report 的 category 身份责任，把 topic 身份固定到全局唯一文件名，并让 tags 和派生索引承担分类与筛选。

## Context

- [`maintain-topic-level-investigation-index`](../../docs/decisions/maintain-topic-level-investigation-index.md) 当前把 `<category-id>/<semantic-slug>.md` 定义为 topic ID，并由索引投影 category、status、latest 和全文检索信息。
- [`stage-selected-investigation-index-entries`](../../docs/decisions/stage-selected-investigation-index-entries.md) 当前按路径 topic ID 选择暂存目标，资源目录的聚合 metadata 仍有独立选择边界。
- 本 Change、已归档的 [`adopt-tagged-decision-records`](../archive/adopt-tagged-decision-records/design.md) 与 [`adopt-tagged-test-evidence-cases`](../adopt-tagged-test-evidence-cases/design.md) 源自同一组 draft，并暂用同一工作定义：目标资源文件是 274 条 Decision Records、12 个 Investigation Report topic（不含 `_resources/`）和 493 个 Test Evidence case，共 779 个权威 Markdown；“全局文件名唯一”指这些文件的 basename（含 `.md`）在合并集合中不重复，不包含派生索引、说明文件和调查附件。大小写与 Unicode 规范化规则仍待确定，这一定义也不是长期 owner。
- 当前 12 个 topic 的 basename 在合并集合中没有冲突；`_resources/` 另有 4 个 Markdown 附件，它们不是 topic、不参与 topic 身份迁移，也不进入本组文件名门禁。
- topic Markdown 可以链接 `docs/investigations/_resources/` 中的证据附件。文件从 category 子目录平铺到根目录会改变相对路径深度，迁移必须同步核对附件引用，但附件 ID 和资源目录不因此变成 topic tag。
- Investigation Report 没有 Decision Records 的活动/归档状态转换，也不需要为了共享表面结构新增归档扫描、归档索引或归档命令。
- 本 Change 与 Decision Records、Test Evidence 的标签化 Change 只共享文件名唯一性和 tag/query 最小语义；调查报告的追加式报告结构、资源边界、状态和索引 owner 继续属于 Investigation Report。三个 Change 暂定按 Decision Records、Investigation Report、Test Evidence 的顺序推进，并在进入任一 Plan 前先确认共同契约。

## Goals / Non-Goals

目标：

- 把 topic ID 从 `<category-id>/<semantic-slug>.md` 收敛为目录无关的稳定文件名身份。
- 让每个 topic 在权威源中携带多个 tags，并让 index、list、find 和 stage 使用稳定 ID 与 tags。
- 将 topic Markdown 平铺到调查根目录，同时保留 `_resources/`、派生索引和现有报告追加行为的明确 owner。
- 迁移现有 topic、索引键、调用参数和相对资源链接，并用完整集合校验保证没有遗漏或冲突。
- 服从三个集合共同的全局文件名唯一性与兼容 tag 语义，不复制 Decision Records 的生命周期设计。

非目标：

- 不为调查报告增加活动/归档目录、归档命令或跨状态解析。
- 不改变单 topic 内的调查背景、报告追加、当前结论、状态与边界表达责任。
- 不改变 `_resources/` 的资源 ID、聚合 metadata 或附件管理模型，除非平铺迁移要求更新引用定位。
- 不在本 Change 中改造 Decision Records、Test Evidence 或建立通用资源 API。
- 不在 draft 阶段移动 12 个 topic、重建索引或删除 category 兼容代码。

## Decisions

当前责任拆分如下；“暂定”项必须在进入 Plan 前由开放问题收敛：

| 责任 | 当前设计方向 | 判断状态 |
| --- | --- | --- |
| 身份 | Topic ID 等于 basename（含 `.md`），不包含 category 或目录；移动目录不改变 ID | 已确认方向 |
| 文件命名 | basename 服从 779 个目标资源文件的合并集合唯一性门禁 | 已确认方向，规范化规则待定 |
| 分类 | tags 写入 topic 权威元数据并允许多值，category 不再从目录隐式派生 | 已确认方向，字段与迁移映射待定 |
| 存放与定位 | topic 直接平铺在 `docs/investigations/`，索引保存稳定 Topic ID 与 `sourcePath` | 已确认方向，发现白名单待定 |
| 选择性暂存 | `stage-index` 继续选择 topic，tag 变化随所选 topic 进入目标，不暂存分类容器 | 已确认方向 |
| 附件 | `_resources/` 及其聚合 metadata 保持独立，不进入 topic 平铺集合与文件名门禁 | 已确认边界 |
| 生命周期 | Investigation Report 不增加活动/归档状态或归档命令 | 已确认边界 |

- **索引继续是派生检索入口。** 每个条目投影稳定 Topic ID、`sourcePath`、tags、status、latest 和现有全文字段；平铺不改成线性扫描。
- **查询从 category 迁移到 tag。** CLI 和 Skill 文档使用共同的 tag token 和组合语义，同时保留 status、latest 与全文条件；迁移完成后只有 topic 元数据是分类事实来源。
- **附件链接随路径迁移验证。** 迁移器或一次性迁移任务重写因目录深度变化而失效的相对链接，并验证每个目标存在，但不改变附件 ID 或资源 owner。
- **旧 category 只作为迁移输入。** 是否把它转换为初始 tag 需要逐项审阅，不能长期同时从目录和元数据派生分类。

## Risks / Trade-offs

- 根目录同时放置 topic、索引和 `_resources/` 后，发现规则必须采用显式保留项并拒绝未知成员；规则不清会把派生文件误当作 topic，或忽略意外文件。
- 从路径 ID 缩短为文件名 ID 会改变 index key、CLI 输入、测试 fixture 和文档链接。集合虽小，仍需一次完整引用扫描，而不能以“只有 12 个文件”为由手工猜测。
- 旧 category 转成 tag 能保留现有查询，但可能把历史分类原样固化为低质量 tags；不自动转换则会失去用户已有筛选习惯。Plan 前需要用当前 12 个 topic 做实际映射审阅。
- 平铺会改变附件相对链接，并可能影响其他文档指向 topic 的链接。稳定 ID 解决语义选择，不会自动修复普通 Markdown 链接。
- 调查报告没有归档，能以较小设计完成标签化；为了三个集合表面一致而加入 locator/lifecycle 层会扩大维护面，因此明确接受三者实现不完全同构。
- 共享全局唯一性检查若在 Decision Records 或 Test Evidence 尚未迁移时过早启用，会阻断现有合法布局；门禁启用需要与三个 Change 的迁移顺序协调。

## Open Questions

1. **[共享]** basename 唯一性是否按大小写折叠和 Unicode 规范化比较，tag token、排序及多 tag AND/OR 语义是什么？
2. **[共享]** 全局文件名门禁与最小 tag/query 契约由哪个现有项目级 owner 承接？
3. **[Investigation]** tags 字段是否必填或允许空集合，写入 topic Markdown 的哪个权威元数据位置？
4. **[Investigation]** 现有 category 值是一对一转成初始 tag，还是基于 12 个 topic 的内容重新审阅？
5. **[Investigation]** 根目录使用什么显式发现白名单区分 topic、派生索引、说明文件和 `_resources/`？
6. **[Investigation]** 旧路径 Topic ID 与 category 查询采用一次性移除还是有退出诊断的短期兼容？
7. **[Investigation]** 普通 Markdown 对 topic 和附件的链接全部重写，还是引入稳定引用解析能力？
