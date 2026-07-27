# Design

本设计以机器可比的迁移清单拆分现有聚合主题文件，并让 topic 表、路径、统一索引和项目 owner 在同一 change 中切换到最终格式。

## Context

- 当前目录包含八个隐式主题文件：`change-plan`、`decision-records`、`index-runtime`、`investigation-report`、`shared-infrastructure`、`skill-updater`、`skill-validator` 和 `test-evidence`。
- 当前索引报告 90 个 case；该数字只描述本 change 建立时的基线。实施前必须重新扫描合法源并把实际数量写入迁移证据，不能把 90 写成长期契约。
- 当前活动决策 `organize-native-test-cases-by-responsibility-topic.md` 已标记 aligned，但它只描述直接子级主题 Markdown。若最终采用受控 topic 目录，该记录与事实都需要通过新的完整判断演进，不能直接改写历史掩盖差异。
- 前置 `organize-test-evidence-by-topic` 负责通用源码、v3 分发物与 Schema、metadata、topic 查询和升级契约；其通用实现和目标测试完成后即可交接本迁移，不以先归档或在 v2 仓库上独立通过最终严格检查为前提。
- v3 分发物与当前 v2 仓库目录不能组成完整检查的稳定中间态。两项 change 必须连续切换到单一 v3 状态，并在迁移后共同运行最终 `bun run check --strict`，不增加双读分支。
- 两个既有 repository catalog 原生节点直接消费本仓库账本；真实目录切换后，它们
  需要从 v2 聚合源路径改为最终 catalog-relative sourcePath/topic，并恢复进入
  `run.ts`。这只是 consumer 集成断言交接，不改变节点名称、测试意图或数量。

## Goals / Non-Goals

目标：

- 让本仓库成为最终 topic 模型的完整消费者，而不是保留工具 fixture 与真实目录两套格式。
- 在拆分文件时保持 case ID 和证据字段逐项可比。
- 为每个 topic 写出稳定责任边界，并审阅跨工具或共享基础设施 case 的主要 owner。
- 让仓库说明、配置、检查和长期决策只指向一个当前格式。
- 让两个既有 repository catalog 节点以原名称和意图验证最终 v3 权威源，并重新
  纳入稳定 runner。

非目标：

- 不借迁移重新设计测试、扩大一般测试覆盖或修改 case 粒度；唯一测试代码例外是
  两个既有 repository consumer 节点的 v3 路径/topic 断言和 import 恢复。
- 不重构其他测试、runner 或 package test 命令，也不提前执行后续原生节点粒度审计。
- 不因 topic 调整修改 case ID。
- 不长期保存“旧文件到新文件”的迁移表；迁移证据只属于本 change。
- 不要求 topic 数量永远等于当前候选数量。

## Decisions

1. 本仓库采用以下九个受控 topic。描述定义唯一主要测试责任，不作为可叠加标签：

   | ID | 责任描述 |
   | --- | --- |
   | `change-plan` | 可持久 change 计划的制品结构、目录查询、检查、生命周期与受门禁归档，以及 CLI 和分发 API 契约。 |
   | `decision-records` | 长期决策的领域目录、身份与路径、生命周期、演进关系、索引维护，以及 CLI 和分发 API 契约。 |
   | `index-runtime` | 跨领域派生状态索引的协议定义、确定性物化、持久化、新鲜度、查询和成本边界；不承接领域自身语义。 |
   | `investigation-report` | 调查报告的目录、结构、时间顺序、范围校验、派生索引，以及 CLI 和分发 API 契约。 |
   | `repository-tooling` | 主仓库根目录与 `scripts/` 所有的完整检查编排、生成文件规范化与漂移判断、待提交 skill package hash 和独立版本门禁。 |
   | `skill-updater` | 已安装 skill 的版本检查、目标与远端包身份、路径安全、release 与 manifest 输入、文件覆盖保留，以及 updater 公共契约。 |
   | `skill-validator` | 单个可移植 Codex skill 的入口、frontmatter、目录和链接结构，以及 validator CLI 与分发制品契约。 |
   | `test-evidence` | 测试证据目录的配置、路径与 case 结构、统一索引同步与回退、查询展示，以及 CLI 和分发 API 契约。 |
   | `version-control` | `tools/shared` 版本管理中间层的 revision、pending、workspace、路径和失败语义；不承接消费方的领域判断。 |

2. 当前 90-case 基线按被证明契约的 owner 迁移。七个专用聚合文件整体进入同名 topic：`change-plan.md` 的 18 个、`decision-records.md` 的 13 个、`index-runtime.md` 的 5 个、`investigation-report.md` 的 10 个、`skill-updater.md` 的 11 个、`skill-validator.md` 的 5 个和 `test-evidence.md` 的 15 个。领域中的索引、生成制品、manifest 或 CLI case 仍证明领域契约，不因使用共享实现而改归基础设施。
3. `shared-infrastructure` 不保留为 topic，因为其中 13 个 case 全部已有更专门 owner。精确分流固定为：
   - `repository-tooling`：`CHECK-PLAN-SCRIPTS-001`、`CHECK-OPTIONS-MODES-001`、`CHECK-STATUS-OUTPUT-001`、`CHECK-STRICT-SCHEDULING-001`、`CHECK-WARNING-SCHEDULING-001`、`CHECK-WORKFLOW-PACKAGING-001`、`CHECK-CLI-CONCURRENCY-001`、`CHECK-CLI-UNKNOWN-OPTION-001`、`GENERATED-FILE-SOURCE-MAP-001`、`GENERATED-FILE-DECLARATION-001`、`GENERATED-FILE-DRIFT-001` 和 `SKILL-PACKAGE-HASH-001`。
   - `version-control`：`VERSION-CONTROL-STATES-001`。
   当前迁移使用这份精确 ID 清单，不把 ID 前缀变成未来自动分类规则。新增或变化的 case 仍以 Contract 与 Proves 对应的稳定 owner 判断；无法确认唯一主要 owner 时阻断迁移，不回退到兜底 topic。
4. 两项 change 使用连续原子交付门禁：`organize-test-evidence-by-topic` 完成通用实现、v3 生成物、Schema、升级契约和目标测试后立即交接本迁移；它不需要先归档，也不需要在 v2 仓库状态上单独通过最终 strict。真实目录、配置和说明切换完成后运行一次最终 `bun run check --strict`，作为两项 change 的共同关闭证据。该原子交付中的 consumer 集成交接严格限定为：
   - 在 `repository-catalog.test.ts` 的两个既有节点中，把旧 v2 源路径断言替换为最终 `test-evidence/rejects-a-catalog-path-that-cannot-be-inspected.md`，并由 show 节点断言 `test-evidence` topic。
   - 在 `run.ts` 恢复对 `repository-catalog.test.ts` 的已有 import，让这两个节点重新进入稳定 runner。
   - 保留两个节点的名称、查询/展示意图和数量；不把该交接扩展为其他测试重构、覆盖扩张或粒度审计。
5. 迁移先从实施起点读取全部合法 case，生成包含源路径、case ID、标题、字段规范化摘要、目标 topic 和目标路径的临时清单；在写入前检查目标路径与 ID 碰撞。
6. 每个目标文件只保存一个 case。文件 slug 从 case 标题或稳定测试意图生成，不把序号、日期或临时任务名称当作语义路径。
7. case ID、Entry、Contract 和 Proves 是迁移前后内容对照的核心；只允许因独立查错而明确批准的语义修复，不把格式迁移与内容重写混在同一机械步骤。
8. 先创建并校验 topic 表与目标文件，再移除中间聚合文件；所有解析后的绝对目标必须位于测试证据根目录。
9. 索引只在全部源文件和 topic 表通过严格目录检查后统一重建，不局部编辑或搬运旧索引 entry。
10. README、配置、导航和检查命令在同一 change 中切换，最终仓库不保留对 `docs/test-evidence/cases/*.md` 的当前格式说明。
11. 最终长期决策应保留“最小原生入口对应 case”并增加受控 topic 表、路径归属和 metadata；当前中间活动决策通过真实关系演进，待工具与仓库事实核对后再建立 aligned 基线。
12. 迁移完成后删除临时映射，保留 change plan、Git diff、严格检查和决策关系作为可回放证据。

## Risks / Trade-offs

- 一个聚合主题文件拆成大量文件会制造较大的 Git diff；需要内容哈希或规范化字段对照区分纯移动与语义变化。
- 当前 case、工具实现和测试代码曾作为同一基线落地。主迁移只修改目录、配置和项目说明；测试代码的唯一例外是两个 repository consumer 节点的最终路径/topic 断言与 import 恢复，必须通过定点 diff 审阅避免把后续测试重构或粒度审计误算为格式迁移。
- 实施起点可能已不再是 90 个 case；新 case 必须按同一 owner 规则补入临时清单，不能机械套用当前文件名或 ID 前缀。
- 当前活动决策过早标记 aligned。演进时必须基于最终事实新建完整判断，不能仅编辑 alignment 或正文制造连续性。
- v3 生成物与 v2 仓库目录的短暂不一致会让完整 strict 失败；这不是可长期保留的中间态。两项 change 必须在同一连续交付中完成切换，并只在最终 v3 状态关闭。
- 不引入双读减少了兼容实现和测试面，但要求迁移代理在前置目标测试通过后立即完成仓库切换，不能把半迁移状态作为独立完成点。

## Open Questions

无。

## Implementation Evidence

### 可比迁移

实施起点从八个 v2 聚合文件解析出 90 个唯一 case，规范化投影固定为按 ID
排序的 `title`、`Entry`、`Contract` 与 `Proves`，SHA-256 为
`9d781f74cf78522ebaff32022dc9e7a55d64c6aac54ec2428f8b655fa79ea61f`。
目标目录逐文件复读后的结果为：

- 83 个既有 case 的规范化字段完全不变。
- 7 个既有 case 保留 ID，但随前置 v3 测试节点与契约演进；逐项原因见下表。
- 新增 16 个 case，对应前置实现新增并由最终 runner 保留的 16 个最小原生测试节点。
- 删除 0 个 case，最终共 106 个；最终规范化投影 SHA-256 为
  `31fd320f2db59f49580b2a087adcec12138ec9274c2770e1a92cac27c3f49895`。

九个 topic 的最终 case 数分别为：`change-plan` 18、`decision-records` 13、
`index-runtime` 5、`investigation-report` 10、`repository-tooling` 12、
`skill-updater` 11、`skill-validator` 5、`test-evidence` 31 和
`version-control` 1。

### 既有 Case 的明确演进

以下七项是内容迁移的唯一例外；未列出的 83 个既有 ID 不允许规范化字段变化。

| ID | Before | After | 理由 |
| --- | --- | --- | --- |
| `TEST-EVIDENCE-PATH-IDENTITY-001` | 标题与证明只概括 catalog 路径的词法别名、大小写身份和硬链接。 | 标题、Contract 与 Proves 明确覆盖配置文件、v3 catalog 根目录、索引目标、解析后路径、平台身份和 inode。Entry 不变。 | 同一原生节点已扩展为 v3 配置、根目录与索引三者的完整身份隔离测试。 |
| `TEST-EVIDENCE-QUERY-SHOW-001` | Contract 使用“跨主题文件”的 v2 聚合文件模型。 | 标题、Contract 与 Proves 改为统一 case 身份、`<topic>/<slug>.md` 路径和单 case 权威正文。Entry 不变。 | 原生节点仍证明 list/search/show，但其源定位断言已切换为 v3 topic 路径。 |
| `TEST-EVIDENCE-CROSS-TOPIC-ID-001` | Contract 与 Proves 把冲突双方称为不同主题文件。 | 标题、Contract 与 Proves 明确冲突跨越 topic 目录中的两个单 case 文件。Entry 不变。 | ID 唯一性不变，承载结构从 v2 聚合文件演进为 v3 topic 路径。 |
| `TEST-EVIDENCE-TOPIC-MEMBERSHIP-001` | Entry 是 `catalog validation rejects empty topic sets and topic files`；契约要求主题集合和每个主题文件非空。 | Entry 改为 `defined topics may be empty but existing topic directories may not`；Contract 与 Proves 改为允许受控表预留空 topic，但拒绝已经创建的空 topic 目录。 | v3 topic 表把“责任已定义”和“目录已物化”分离，旧节点语义已被新节点替代。 |
| `TEST-EVIDENCE-DISTRIBUTED-CLI-001` | 只记录分发 list/show 查询与不可读索引失败。 | 标题、Contract 与 Proves 增加 topic API、Schema、`topics` 命令和 v3 结果，同时保留不可恢复失败语义。Entry 不变。 | 同一分发奇偶性节点已覆盖 v3 topic 公共面。 |
| `TEST-EVIDENCE-QUERY-REPOSITORY-001` | 查询只证明当前仓库 case metadata 与匹配 ID。 | 标题、Contract 与 Proves增加受控 topic 目录、`test-evidence` topic 和单 case 源路径。Entry 不变。 | 仓库集成断言必须指向迁移后的 v3 权威源，而不是已删除的聚合文件。 |
| `TEST-EVIDENCE-SHOW-REPOSITORY-001` | Show 只证明 ID 展开到聚合文件内的自身 Markdown 块。 | 标题、Contract 与 Proves增加 topic 归属、单 case 源路径和跨文件隔离。Entry 不变。 | v3 中相邻 case 已是独立文件，仓库集成证明随权威源结构演进。 |

### 有限 Consumer Integration 交接

迁移完成最终目录与索引后，真实仓库 consumer 只做了以下定点更新：

- `queries the repository catalog by contract and proof terms` 保留原节点名称、查询词、
  目标 case ID 和意图，只把 sourcePath 断言从
  `docs/test-evidence/cases/test-evidence.md` 改为
  `test-evidence/rejects-a-catalog-path-that-cannot-be-inspected.md`。
- `shows the authoritative Markdown for a repository case` 保留原节点名称、case ID、
  Markdown 包含/隔离断言和意图，使用同一最终 sourcePath，并增加
  `test-evidence` topic 定义断言。
- `run.ts` 恢复 `repository-catalog.test.ts` import；没有创建新的聚合节点，也没有
  改变两个原生节点的数量。最终 test-evidence runner 因此报告 31 个节点，其中
  这两个节点仍是迁移前已有的 consumer 集成节点。

这些改动只证明真实 v3 目录已成为工具的当前 consumer，不承担其他测试重构、
覆盖扩张或原生节点粒度审计。

### 新增原生节点

以下新增 case 都位于 `test-evidence` topic；每个 Entry 都能由
`bun test --test-name-pattern="^<exact-name>$" ./tools/test-evidence/tests/run.ts`
独立选择。

| Case ID | 最小原生测试节点 |
| --- | --- |
| `TEST-EVIDENCE-TOPICS-READ-001` | `topics read the authoritative sorted table without an index` |
| `TEST-EVIDENCE-TOPICS-SCHEMA-001` | `topic tables reject missing, malformed, unknown, duplicate, unsorted, and invalid definitions` |
| `TEST-EVIDENCE-ROOT-MEMBERSHIP-001` | `catalog roots reject unknown topic directories and unsupported root files` |
| `TEST-EVIDENCE-CASE-FILE-CARDINALITY-001` | `one case file rejects zero or multiple case headings` |
| `TEST-EVIDENCE-TOPIC-DIRECTORY-001` | `topic directories reject nested, non-Markdown, and symbolic-link members` |
| `TEST-EVIDENCE-INDEX-RESERVED-PATH-001` | `index paths cannot overwrite reserved sources or case files` |
| `TEST-EVIDENCE-INDEX-HARDLINK-001` | `index paths cannot hard-link to reserved sources, config, or case files` |
| `TEST-EVIDENCE-INDEX-TOPIC-PROJECTION-001` | `indexes project sorted topic metadata and path-derived topic keys` |
| `TEST-EVIDENCE-REVISION-TOPIC-MOVE-001` | `topic descriptions and case moves change source revisions without changing case identity` |
| `TEST-EVIDENCE-REVISION-FRAMING-001` | `revision framing normalizes line endings and ignores catalog path, JSON formatting, README, and index content` |
| `TEST-EVIDENCE-INDEX-PROJECTION-VALIDATION-001` | `persisted metadata, source paths, and topic keys are validated as one projection` |
| `TEST-EVIDENCE-TOPIC-FILTER-001` | `topic filters return matching and defined-empty results with topic definitions` |
| `TEST-EVIDENCE-TOPIC-CLI-001` | `unknown and repeated topic CLI arguments fail deterministically` |
| `TEST-EVIDENCE-INVALID-ROOT-INDEX-001` | `queries reject newly invalid root layouts instead of trusting a previous index` |
| `TEST-EVIDENCE-UPGRADE-V1-001` | `documented v1 consumer upgrade produces an isolated v3 topic catalog` |
| `TEST-EVIDENCE-UPGRADE-V2-001` | `documented v2 consumer upgrade produces an isolated v3 topic catalog` |

独立盘点同时确认：稳定 `test:*` 调用链原有 104 个可报告节点，恢复两个仓库
catalog 集成节点后为 106；其中 test-evidence runner 为 31 个节点。该结果与最终
106 个 case 一一对应，不提前吸收后续测试结构审计可能拆出的新节点。

### 最终验证

- `bun run test:test-evidence-cli`：31 个 test-evidence 原生节点全部通过，包括
  恢复 import 且只更新 v3 sourcePath/topic 断言的两个既有仓库 catalog 集成节点。
- `bun run check:test-evidence-catalog`：9 个 topic、106 个 case，目录与统一索引
  无诊断。
- `topics`、`list --topic test-evidence` 与
  `show TEST-EVIDENCE-CONFIG-PATH-001`：分别返回受控表、31 个 topic case 和
  `test-evidence/rejects-a-catalog-path-that-cannot-be-inspected.md` 权威源，
  均无诊断。
- `bun run validate` 与 `bun run typecheck`：链接、项目配置和类型检查通过。
- 对齐前 `bun run check --strict` 通过后，使用 decision-records CLI 将
  `test-evidence-review/organize-test-cases-by-controlled-topic-path.md` 标记为
  aligned；随后决策检查报告 43 个活动决策全部 aligned。
- 对齐后的最终 `bun run check --strict` 通过全部 23 项 preflight 与 packaging；
  change 保持活动状态，未归档。
