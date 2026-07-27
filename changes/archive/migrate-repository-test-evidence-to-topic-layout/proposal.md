# Proposal

本 change 计划把本仓库当前按主题文件聚合的测试证据迁移到受控 topic 目录和单 case 文件；本文规划仓库数据、说明与严格限定的 repository consumer 集成交接，不实现通用工具，也不承担一般测试重构。

## Why

当前仓库已经使用 `docs/test-evidence/cases/*.md` 和统一索引，并按八个文件名隐式表达责任主题。但每个文件仍聚合多个 case，topic 没有独立定义和边界说明，当前活动决策也只确认了“主题 Markdown”，尚未对齐拟采用的主题表、topic 目录和单 case 文件模型。

在可分发工具完成最终 topic 契约后，本仓库需要以真实消费者身份完成一次可审计迁移，证明历史 case 不丢失、身份不漂移、主题归属可解释，且项目文档和严格检查只指向最终格式。

前置工具生成 v3 分发物后，仍使用 v2 目录的仓库会在完整严格检查中暂时失败。两项 change 因此需要连续交付：前置 change 先完成通用实现和目标测试，本 change 随即切换真实仓库，最后在单一 v3 状态上共同通过完整检查，而不是引入 v2/v3 双读。

真实目录切换也会使两个既有 `repository-catalog.test.ts` 节点仍引用已删除的 v2
聚合源路径。作为 v3 consumer 验收的一部分，本 change 需要把这两个节点的
sourcePath 与 topic 断言切换到最终目录，并在 `run.ts` 恢复已有 import；节点名称、
测试意图和数量都不改变。

## Outcome

- 本仓库建立 `docs/test-evidence/test-evidence-topics.json`，保存经过审阅的 topic ID 与责任描述。
- 所有现有合法 case 各自迁移为 `<topic-id>/<semantic-slug>.md`，保留原 case ID、Entry、Contract 和 Proves。
- `docs/test-evidence/test-evidence-index.json` 从主题表和全部 case 文件重建，并能按 topic、case ID 和文本查询。
- `.test-evidence.json`、AGENTS、导航、工具链说明和仓库检查只引用最终目录。
- 两个既有 repository catalog 节点的目录相关断言只切换为最终
  catalog-relative sourcePath 与 topic，`run.ts` 恢复导入，最终 runner 仍以
  原名称和意图报告这两个节点。
- 与当前中间主题文件格式相关的活动决策在最终事实完成后得到正确演进和对齐。
- 前置工具 change 与本迁移在最终 v3 仓库上共同通过 `bun run check --strict` 后再关闭。

## Scope

纳入范围：

- 当前工作区与实施起点中全部合法 test-evidence case 的清单、topic 归属、文件拆分和路径迁移。
- 仓库 topic 表、测试证据 README、派生索引和项目配置。
- `AGENTS.md`、`docs/navigation.md`、`docs/tooling.md` 及必要的人类说明链接。
- 项目检查入口对最终测试证据目录和索引新鲜度的接入。
- 当前测试证据主题决策的演进、索引同步和最终对齐核对。
- `tools/test-evidence/tests/repository-catalog.test.ts` 中两个既有 consumer 节点的
  v3 sourcePath/topic 断言，以及 `tools/test-evidence/tests/run.ts` 对该模块的
  import 恢复。

不纳入范围：

- 修改 `tools/test-evidence/` 或可分发 skill 的通用行为；前置 change 负责。
- 除上述有限 consumer 断言与 import 恢复外，修改测试节点名称、意图或数量，
  重构其他测试或 runner，调整 package test 命令，或新增一般测试覆盖；后续
  change 负责。
- 重新解释 case 的测试价值、改变 Entry 指向的测试意图或把工程校验纳入目录。
- 自动分类、源码扫描、marker、采集器或长期保存迁移映射。

## Success Criteria

- 实施起点的每个合法 case ID 在迁移后恰好存在一次，字段语义未因文件拆分改变。
- 每个 case 文件位于一个已定义 topic 目录，文件中只包含该 case；不存在中间 `cases/*.md` 聚合文件。
- topic 表中的描述足以区分责任边界；未知、空、嵌套或未定义目录不存在。
- 迁移清单证明源 case 数、目标 case 数、ID 集合和字段内容一致，并明确解释任何实施期间新增或删除的 case。
- 仓库配置、说明、检查和查询全部使用最终 topic 根目录，统一索引处于当前状态。
- 相关决策只描述最终有效布局，并在实现与完整检查通过后才标记对齐。
- 两个既有 repository catalog 节点只更新到最终 sourcePath/topic 并恢复进入
  runner，节点名称、意图和数量保持不变，31 个 test-evidence 节点全部通过。
- test-evidence 目录检查、决策严格检查、链接检查和完整仓库检查通过。
- 迁移没有引入 v2/v3 双读、长期兼容层或要求前置 change 在旧仓库布局上独立通过最终严格检查。

## Affected Owners

- `docs/test-evidence/`：本仓库的 topic 表、case 权威源、说明与派生索引。
- `.test-evidence.json`：本仓库测试证据根目录和索引配置。
- `AGENTS.md`、`docs/navigation.md` 与 `docs/tooling.md`：仓库路由、owner 和稳定命令。
- `docs/skills/test-evidence-review.md`：面向人类的仓库采用说明。
- `docs/decisions/test-evidence-review/` 与决策索引：主题布局和 case 身份的长期判断。
- `package.json`、`scripts/lib/check-plan.ts` 及相关测试：项目级严格检查入口。
- `tools/test-evidence/tests/repository-catalog.test.ts` 与
  `tools/test-evidence/tests/run.ts`：真实仓库 consumer 的最终路径/topic 断言与
  两个既有节点的 runner 接入；不承接一般测试重构。

## Dependencies

本 change 与 `organize-test-evidence-by-topic` 按连续原子交付协作，不要求前置
change 先归档，也不要求它在仓库仍使用 v2 目录时独立通过
`bun run check --strict`。本 change 的启动门禁是前置 change 的通用源码、v3
分发物与 Schema、升级契约和目标测试已经完成并可交接；随后立即执行真实仓库
迁移，期间不引入 v2/v3 双读。迁移完成后在最终 v3 仓库上运行完整严格检查，
其结果作为两项 change 的共同关闭门禁，并为
`audit-repository-native-test-ledger` 提供稳定 topic 表、单 case 路径和当前索引
基线。
