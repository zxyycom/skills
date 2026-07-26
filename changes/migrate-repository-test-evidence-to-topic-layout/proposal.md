# Proposal

本 change 计划把本仓库当前按主题文件聚合的测试证据迁移到受控 topic 目录和单 case 文件；本文只规划仓库数据与说明迁移，不实现通用工具，也不改造测试代码。

## Why

当前仓库已经使用 `docs/test-evidence/cases/*.md` 和统一索引，并按八个文件名隐式表达责任主题。但每个文件仍聚合多个 case，topic 没有独立定义和边界说明，当前活动决策也只确认了“主题 Markdown”，尚未对齐拟采用的主题表、topic 目录和单 case 文件模型。

在可分发工具完成最终 topic 契约后，本仓库需要以真实消费者身份完成一次可审计迁移，证明历史 case 不丢失、身份不漂移、主题归属可解释，且项目文档和严格检查只指向最终格式。

## Outcome

- 本仓库建立 `docs/test-evidence/test-evidence-topics.json`，保存经过审阅的 topic ID 与责任描述。
- 所有现有合法 case 各自迁移为 `<topic-id>/<semantic-slug>.md`，保留原 case ID、Entry、Contract 和 Proves。
- `docs/test-evidence/test-evidence-index.json` 从主题表和全部 case 文件重建，并能按 topic、case ID 和文本查询。
- `.test-evidence.json`、AGENTS、导航、工具链说明和仓库检查只引用最终目录。
- 与当前中间主题文件格式相关的活动决策在最终事实完成后得到正确演进和对齐。

## Scope

纳入范围：

- 当前工作区与实施起点中全部合法 test-evidence case 的清单、topic 归属、文件拆分和路径迁移。
- 仓库 topic 表、测试证据 README、派生索引和项目配置。
- `AGENTS.md`、`docs/navigation.md`、`docs/tooling.md` 及必要的人类说明链接。
- 项目检查入口对最终测试证据目录和索引新鲜度的接入。
- 当前测试证据主题决策的演进、索引同步和最终对齐核对。

不纳入范围：

- 修改 `tools/test-evidence/` 或可分发 skill 的通用行为；前置 change 负责。
- 修改测试函数、runner、package test 命令或新增测试覆盖；后续 change 负责。
- 重新解释 case 的测试价值、改变 Entry 指向的测试意图或把工程校验纳入目录。
- 自动分类、源码扫描、marker、采集器或长期保存迁移映射。

## Success Criteria

- 实施起点的每个合法 case ID 在迁移后恰好存在一次，字段语义未因文件拆分改变。
- 每个 case 文件位于一个已定义 topic 目录，文件中只包含该 case；不存在中间 `cases/*.md` 聚合文件。
- topic 表中的描述足以区分责任边界；未知、空、嵌套或未定义目录不存在。
- 迁移清单证明源 case 数、目标 case 数、ID 集合和字段内容一致，并明确解释任何实施期间新增或删除的 case。
- 仓库配置、说明、检查和查询全部使用最终 topic 根目录，统一索引处于当前状态。
- 相关决策只描述最终有效布局，并在实现与完整检查通过后才标记对齐。
- test-evidence 目录检查、决策严格检查、链接检查和完整仓库检查通过。

## Affected Owners

- `docs/test-evidence/`：本仓库的 topic 表、case 权威源、说明与派生索引。
- `.test-evidence.json`：本仓库测试证据根目录和索引配置。
- `AGENTS.md`、`docs/navigation.md` 与 `docs/tooling.md`：仓库路由、owner 和稳定命令。
- `docs/skills/test-evidence-review.md`：面向人类的仓库采用说明。
- `docs/decisions/test-evidence-review/` 与决策索引：主题布局和 case 身份的长期判断。
- `package.json`、`scripts/lib/check-plan.ts` 及相关测试：项目级严格检查入口。

## Dependencies

本 change 必须等待 `organize-test-evidence-by-topic` 完成并通过其验证；在此之前，
当前 `cases/*.md` 继续作为权威源，不能先行迁移。它完成后为
`audit-repository-native-test-ledger` 提供稳定 topic 表、单 case 路径和当前
索引基线。
