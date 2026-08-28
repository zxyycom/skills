# Proposal

本 Plan 将 Investigation Report 从“主题文件聚合多份线性报告”改造为“一份文件一份报告、稳定 Investigation ID 标识身份、记录级 tags 分类、显式关系图表达认识演进”的报告级模型，并以一次不兼容迁移让新契约成为唯一当前格式。

## Why

当前 `<category-id>/<semantic-slug>.md` 同时承担主题身份、单一分类、继续调查状态、多份报告容器、资源 owner 和索引 entry。主题内 H3 顺序只能表达时间先后，不能准确表达跨主题补充、复查、修正、推翻、归并或拆分；category 目录也让分类变化变成身份和路径迁移。随着报告积累，同一主题必须保持线性、不同主题又无法建立直接演进，已经限制调查认识的真实关系。

调查报告保存形成时输入、依据、结果与边界，不像长期决策那样拥有当前约束与历史退出边界。后来报告即使推翻前序，也不应把前序移出正式集合。新模型需要保留固定调查核心和资源复核能力，同时取消主题、category、主题状态、最新报告时间及隐式追加顺序，并为关系调整提供受控命令，避免维护者手改 Markdown 后再承担完整同步压力。

## Outcome

每份调查报告以根目录直属 Markdown 和唯一 basename（含 `.md`）形式的 Investigation ID 独立存在；frontmatter 直接保存标题、形成时间、本轮问题、至少一个 tag 和完整直接前序关系，正文继续依次保存形成时背景、调查目的、调查范围与依据、调查结果与边界。所有报告永久留在同一正式集合，不建立 candidate、active 或 archive 生命周期。

派生索引按 Investigation ID 投影 tags、形成时间、问题、关系和资源引用；报告路径由根目录和 ID 唯一计算，不再保存重复的 `sourcePath`。查询支持 tag、时间、关系类型与文本，`show` 和 `trace` 可以恢复单份报告及其前序、后继。`set-relations` 在一次事务中完整替换一份或多份已建立报告的关系并同步索引；报告创建、删除、正文、tag 或资源引用变化仍由授权的文件编辑完成，随后使用 `sync-index` 重建投影。`sync-index` 不再是调整既有关系的唯一公共路径。

本仓库现有主题中的每个 H3 报告一次性迁移为独立文件，旧 category 作为初始 tag 输入，关系只依据报告语义建立而不从相邻顺序推断。旧主题格式、路径 ID、category 查询、主题状态和兼容 reader 在同一次切换后退出。

## Scope

### Intended Change

- 建立报告级 Investigation ID、平铺目录、frontmatter、固定正文、非空 tags 与关系图契约。
- 使用`补充`、`复查`、`修正`、`推翻`、`归并`和`拆分`六种直接前序关系，并提供图校验、双向 trace 与受控 `set-relations` 写入。
- 将索引、查询、选择性暂存、资源 owner、Skill 行为、固定契约、Schema、生成产物和项目导航迁移到报告级模型。
- 从 Decision Records 关系实现中抽取真正领域无关的建图、trace 与环检测能力；决策生命周期和调查语义继续由各自 owner 承接。
- 逐份迁移当前调查集合、资源引用、仓库链接和相关长期决策，不保留新旧格式双读或迁移命令。

### Resulting Impacts

- 审计基线中的 12 个主题文件实际包含 33 份合法 H3 报告和 5 个版本控制可见资源；[`migration-manifest.json`](migration-manifest.json) 已为每份报告固定目标身份、内容指纹、tags、关系和资源映射，实施写入前以其中的 source revision 拦截漂移。
- 主题级索引、固定调查核心、资源 owner、资源 revision、未引用资源 warning 和选择性暂存的现行长期决策需要按实际改变范围建立闭合后继，不能让相互冲突的 active 决策同时保留。
- `_resources/<category-id>/<topic-slug>/...` 将迁移为 `_resources/<investigation-id-without-md>/...`；共享资源需要选定唯一引入报告作为 owner，并更新全部引用。
- Investigation Report 与 Decision Records 都会消费共享关系图原语；共享实现变化必须证明 Decision Records 的现有关系、生命周期和 trace 行为没有回归。
- 工具源码、分发脚本、Schema、测试及 Test Evidence 账本需要同步；稳定 owner 和直接维护链接需反映新路径与命令。

## Success Criteria

- 每个合法调查 Markdown 只保存一份报告，Investigation ID 同时决定根目录相对路径；title、formedAt、question、tags、relations 和可选资源引用都只有一个权威来源，索引不保存可由 ID 计算的重复定位字段。
- tags 非空、合法、唯一且确定性排序；重复 tag 查询使用 AND，category 目录与 `--category` 不再是分类事实或公共入口。
- 六种关系只指向现存直接前序，重复、自环、缺失目标、逆时间、非法归并/拆分形状和全图环都被拒绝；`trace` 能恢复前序、后继或双向子图。
- `set-relations` 接受一个或多个 source 组，每组以显式完整关系集合或显式清空表达最终状态；命令在一次图预演和事务中处理全部所选报告，使拆分等多后继调整不需要中间非法状态，并在来源或索引漂移时写前失败。
- 推翻、修正或其他后继关系不移动、隐藏、归档或删除前序报告；默认查询仍覆盖全部正式报告。
- 迁移前后的报告数量、形成时间、固定核心、资源引用和可复核语义逐份对账；没有从旧 H3 邻接顺序补造关系，也没有序号式占位 ID。
- 目标 Skill、CLI、Schema、源码、生成物、项目文档和权威数据只支持新模型；没有旧主题 parser、topic/category 双写、兼容 reader、公开迁移器或残留路径关系目标。
- Investigation Report、共享关系图、Decision Records 回归、资源校验、Test Evidence 派生账本和全仓检查全部通过。

## Affected Owners

| Owner | 本 Change 的责任 |
| --- | --- |
| `skills/investigation-report/` | 更新 agent 行为、固定契约、索引 Schema、CLI 说明、生成产物与 skill 版本。 |
| `tools/investigation-report/`、`scripts/build/investigation-report.ts` | 实现报告解析、身份、tags、关系、索引、查询、关系事务、资源和 CLI 行为。 |
| `tools/shared/`、`tools/decision-records/` | 抽取并消费领域无关关系图原语，保持决策专属生命周期与关系约束不变。 |
| `docs/investigations/` | 将每份旧 H3 报告迁移成权威文件，迁移资源 owner 和链接，重建派生索引。 |
| `docs/decisions/` | 通过 Decision Records 正式关系事务演进与新模型冲突或被其修订的长期决策。 |
| `docs/test-evidence/` | 维护受影响原生测试入口的权威 case 与派生索引。 |
| `docs/navigation.md`、`AGENTS.md`、`docs/skills/investigation-report.md` | 同步稳定 owner、任务路由、人类入口和直接维护约定，不复制固定契约。 |
