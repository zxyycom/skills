# Design

本设计暂定以稳定决策 ID、记录级 tags 和带当前路径的派生索引拆开身份、分类与物理生命周期，并把领域模型的退出作为显式迁移处理。

## Context

- [`docs/repository-model.md`](../../docs/repository-model.md) 要求各 skill 保持自己的行为 owner，根目录只维护跨 skill 的共享能力；因此本 Change 只改造 Decision Records，不建立通用资源平台。
- 本 Change 与 [`adopt-tagged-investigation-topics`](../adopt-tagged-investigation-topics/design.md)、[`adopt-tagged-test-evidence-cases`](../adopt-tagged-test-evidence-cases/design.md) 组成同一组 draft，并暂用同一工作定义：目标资源文件是 274 条 Decision Records、12 个 Investigation Report topic（不含 `_resources/`）和 493 个 Test Evidence case，共 779 个权威 Markdown；“全局文件名唯一”指这些文件的 basename（含 `.md`）在合并集合中不重复，不包含派生索引、说明文件和调查附件。大小写与 Unicode 规范化规则仍待确定，这一定义也不是长期 owner。
- 三个 Change 暂定按 Decision Records、Investigation Report、Test Evidence 的顺序推进：进入任一 Plan 前先确认共同的文件名与 tag 契约，先用 Decision Records 验证目录无关身份和归档定位，最后在 Test Evidence 迁移完成时启用全局唯一性门禁。
- 当前 Decision Records 以 `docs/decisions/<domain-id>/<semantic-slug>.md` 组织记录，受控领域表、路径第一段、关系目标、查询参数和部分暂存输入共同依赖 domain。
- 已对齐决策 [`classify-decisions-by-controlled-domain-path`](../../docs/decisions/decision-records/classify-decisions-by-controlled-domain-path.md) 与 [`project-domains-into-decision-queries`](../../docs/decisions/decision-records/project-domains-into-decision-queries.md) 固定了现行领域模型；改造必须用合法后继决策演进这些长期契约，而不能把新行为伪装成原规则的文字修正。
- 已有未对齐方向 [`upgrade-decision-domains-after-real-pressure`](../../docs/decisions/decision-records/upgrade-decision-domains-after-real-pressure.md) 与 [`use-physical-archive-boundary-for-decision-search`](../../docs/decisions/decision-records/use-physical-archive-boundary-for-decision-search.md) 分别记录领域演进压力和物理归档边界。标签化模型需要同时回答两者，而不是只替换查询参数。
- 当前仓库有 274 条 Decision Records。决策间关系以及仓库内其他结构化索引和文档引用仍包含路径身份；迁移必须盘点并转换这些调用方，不能只移动 Markdown。
- 当前仅发现一组同名目标资源文件，两个文件都位于 Test Evidence 集合的不同 topic 目录。Decision Records 自身没有冲突，但仍必须服从合并集合门禁。
- 当前 draft [`stage-new-decision-domains-with-initial-records`](../stage-new-decision-domains-with-initial-records/) 与本 Change 在长期方向上重叠。它在本 draft 阶段继续保留；只有本方向确认并进入 Plan 后，才决定归档、替代或继续该 draft，避免静默丢失其问题记录。

## Goals / Non-Goals

目标：

- 让决策身份不再由领域目录或活动/归档位置决定。
- 让一条决策可以拥有多个 tags，并通过标签组合、状态和全文条件查询，而不是只能归入一个领域。
- 让索引保存稳定 ID 到当前路径的映射，使定位成本不依赖目录扫描，并允许物理归档移动而不改 ID。
- 让关系、候选、激活、演进、归档、对齐和选择性暂存围绕稳定 ID 工作，同时保留现有完整集合校验和原子替换责任。
- 为领域表、领域路径、旧查询参数和所有路径引用提供可验证的迁移与退出顺序。
- 与 Investigation Report、Test Evidence 共享兼容的 tag token、查询语义和全局文件名唯一性约束，但让 owner、身份字段和生命周期继续分别维护。

非目标：

- 不在本 Change 中改造 Investigation Report 或 Test Evidence。
- 不建立统一的 `ResourceDescriptor`、第四套全局资源索引或跨 skill 的通用 CRUD 平台。
- 不把状态、对齐、关系类型、生命周期阶段或物理归档位置编码成普通 tag。
- 不在 draft 阶段执行记录迁移、删除领域表、处置重叠 Change 或确定全部 CLI 拼写。
- 不引入必须预先登记所有 tag 的受控标签目录；若后续发现确需约束，只为语法、保留词或稳定语义建立最小 owner。

## Decisions

当前责任拆分如下；“暂定”项必须在进入 Plan 前由开放问题收敛：

| 责任 | 当前设计方向 | 判断状态 |
| --- | --- | --- |
| 身份 | Decision ID 等于 basename（含 `.md`），不包含目录；改名属于显式身份迁移，移动目录不改变 ID | 已确认方向 |
| 文件命名 | basename 服从 779 个目标资源文件的合并集合唯一性门禁 | 已确认方向，规范化规则待定 |
| 分类 | tags 写在每条决策的权威源元数据中，允许多值；索引只做派生投影 | 已确认方向，字段语法待定 |
| 定位 | 索引把稳定 Decision ID 映射到唯一的当前 `sourcePath` | 暂定 |
| 专属语义 | 状态、对齐、关系和生命周期继续使用结构字段，不编码成普通 tag | 已确认边界 |
| 活动与归档 | 物理位置可以变化，但同一权威快照中一个 ID 只能解析到一个源文件，且移动不改变 ID | 已确认方向，目录与索引布局待定 |

- **关系和结构化外部引用使用稳定 ID。** 关系校验先解析 ID，再通过索引定位活动或归档源。普通 Markdown 链接的迁移方式仍待确定，不把物理路径继续作为语义身份。
- **查询以 tag 为分类入口，并保留专属结构条件。** tag 查询需要定义多值组合语义；状态、对齐、关系和全文条件仍为独立过滤器，不能只把 `--domain` 改名为 `--tag` 后保留单分类假设。
- **分阶段迁移而非长期双身份。** 实施应先让 reader、index 和 checker 理解稳定 ID/tags，再迁移记录与引用，最后移除 domain owner 和兼容入口；兼容层只服务迁移窗口，并需要明确退出检查。
- **共同契约先收敛，再由三个领域分别实现。** 三个 Change 在进入 Plan 前共同确认 tag token、查询组合和全局文件名唯一性的项目级 owner；除非核对后出现独立可交付责任，否则不建立第四个通用资源 Change。

## Risks / Trade-offs

- 领域当前同时保护路径、查询和关系边界。一次拆开这些责任会触及 schema、parser、索引、CLI、stage、归档、生成产物、Skill 契约、决策记录和大量测试，Decision Change 因而应先于另外两个 Change 验证共同规则，但不能把 Decision Records 的复杂生命周期泄漏给它们。
- 文件名成为稳定 ID 后，命名冲突从局部目录问题升级为项目级错误。好处是引用不再依赖路径，代价是创建、迁移和检查都必须在完整的三个集合范围内执行唯一性门禁。
- 自由 tags 降低重组成本，也可能产生拼写漂移和近义词。严格全量注册表会重新制造领域重组负担；暂定以规范化语法、查询可见性和按需治理代替预先审批。
- 活动与归档共用稳定 ID 后，索引必须明确来源状态并拒绝双重存在；否则同一 ID 可能解析到两个文件。归档写入仍需要保留原子性、可恢复性和完整关系校验。
- 仓库内存在结构化路径引用和普通 Markdown 链接。前者必须迁移，后者若全部重写会扩大变更面，若不重写又可能在移动后失效，需要先分类再决定兼容策略。
- 直接删除领域能力会让未迁移调用方失效；长期保留 domain/tag 双模型则会形成两个分类事实来源。迁移计划必须把双读、双写或一次性转换的期限和验证出口写清楚。

## Open Questions

1. **[共享]** basename 唯一性是否按大小写折叠和 Unicode 规范化比较，tag token、排序及多 tag AND/OR 语义是什么？
2. **[共享]** 全局文件名门禁与最小 tag/query 契约由哪个现有项目级 owner 承接？
3. **[Decision]** tags 字段是否必填或允许空集合，写入现有 Markdown 的哪个权威元数据位置？
4. **[Decision]** 活动与归档记录采用什么目录布局、索引拆分方式和默认搜索范围？
5. **[Decision]** 普通 Markdown 路径链接应批量改写、使用稳定引用语法，还是只保证结构化引用目录无关？
6. **[Decision]** 迁移采用一次性原子转换还是短期兼容旧 domain schema；若兼容，哪个检查负责退出门禁？
7. **[Decision]** `stage-new-decision-domains-with-initial-records` 在本方向进入 Plan 时应归档为被替代方向，还是把其中仍独立成立的选择性元数据暂存问题并入本 Change？
