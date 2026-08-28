# Readiness Audit

本附件保存 `establish-investigation-report-evolution` 进入实施前已经完成的范围、数据、关系、owner、调用面、测试证据和写入边界审计。它与 [`migration-manifest.json`](migration-manifest.json) 一起为 `tasks.md` 的 Readiness checkbox 提供证据；proposal 继续拥有 Outcome、范围和成功标准，design 继续拥有目标契约，本附件不覆盖两者。

## 审计基线与入口

- 审计基线是 Git `HEAD` `51a6946064212f574bf3dab63f05d6e3b7cee94c`，审计日期为 2026-08-28。审计期间没有修改 `docs/investigations/`、工具源码、测试、决策或 Task Graph。
- `bun run check:investigations` 通过：12/12 topics、10 个 category、完整索引新鲜。
- `bun run check:decisions` 通过：290 条决策，其中 116 active、112 aligned、4 unaligned、174 archived、0 candidates。
- `bun run check:test-evidence-catalog` 通过：10 个 topic、578 个 case；其中 Investigation Report topic 有 58 个 case。
- `bun run change-plan -- check-all changes --json` 通过：10 个 active Change 全部结构有效。与本 Plan 直接重叠的 `separate-investigation-resource-validation-from-index-state` 已完成 16/16 tasks；`adopt-tagged-test-evidence-cases` 仍是独立 Draft，不是本 Plan 的前置。
- CodeGraph 索引可用，共覆盖 348 个文件、23,725 个节点和 98,595 条边。调用面结论以本次 CodeGraph 结果为基线；实施中新增或移动源码后仍以更新后的索引和编译、测试结果为准。
- Task Graph 索引在审计时为 revision 349、68 个 task，`valid: true`、`canonical: true`；mutation runtime 为 compatible。revision 只记录审计快照，实施写入前必须重新读取，不能重放 349。

## 调查集合与迁移映射

### 已确认数量

| 对象 | 数量 | 证据与含义 |
| --- | ---: | --- |
| 旧 topic | 12 | 当前调查索引的 12 个 entry。 |
| 合法 H3 报告 | 33 | 当前索引各 entry 的 `reportCount` 总和，也是逐 topic 解析得到的报告数。 |
| 版本控制可见资源 | 5 | `_resources/` 下 2 个 Codex 会话资源和 3 个 Test Evidence Change 资源。 |
| 有直接前序关系的目标报告 | 21 | 逐份语义审阅后写入迁移清单；没有从相邻顺序自动生成。 |
| 独立目标报告 | 12 | 没有足够直接演进依据时显式保留空关系。 |

报告数量只使用固定契约 parser 与当前索引 entry 的 `reportCount` 统计；`_resources/` 内 Markdown 标题不是报告，迁移只处理由调查集合发现和索引投影的 33 份报告。

### 权威迁移清单

[`migration-manifest.json`](migration-manifest.json) 已逐份固定以下信息：

1. 旧 topic path、旧报告序号、旧标题、旧 topic 问题与状态；
2. 目标 Investigation ID、title、单行 question、非空 tags 和完整直接前序关系；
3. formedAt、旧/新资源 ID、四项核心与附加章节的内容指纹；
4. 旧 H3 完整块指纹，以及 5 个资源的字节指纹、目标 owner 和目标路径；
5. 当前调查索引的完整 `sourceRevision`，用于实施前检测源集合漂移。

清单中的 33 个 ID 全部符合 `^[a-z0-9]+(?:-[a-z0-9]+)*\.md$` 且集合内唯一；每份报告只使用旧 category 对应的一个初始 tag，避免在迁移中引入没有正文依据的额外分类。21 条关系全部指向已存在且形成时间不晚于 source 的报告；当前真实数据不需要 `归并` 或 `拆分`，这两种类型仍由领域契约和 fixture 测试覆盖。

实施写入前重新计算当前 source revision 并与清单逐 entry 比较：

- 完全一致时按清单实施；
- 只有部分 topic 改变时，停止写入，重新解析并人工复核受影响 topic 的全部目标行、普通链接和资源引用，再更新清单；
- 集合身份、关系语义或 owner 选择出现新歧义时，先修订 Change artifacts；不得用旧清单覆盖新内容。

这个漂移门禁是输入新鲜度检查，不是未决设计问题。

## 状态退出、Task Graph 与链接交接

### 旧状态处置

| 旧状态 | Topics | 处置 |
| --- | --- | --- |
| `调查中` | `ai-ready-docs/target-boundary-information-and-anchoring.md` | 没有对应的当前 Task Graph、Change 或其他协调 owner；33 份报告中的相关 19 份按清单迁移，旧状态直接退出，不制造叶节点状态。 |
| `暂停` | Codex 会话保存、统一上下文管理、Git 库选型、Prompt Optimize 命名、Skill 动作时重路由共 5 个 topic | 前四项没有当前协调载体，状态直接退出；Skill 重路由已经由 `task-000068` 以 waiting 状态承接，迁移只更新该 task 的调查引用。 |
| `已结束` | 决策演进、三个实现库选型、Task Graph 文件事务库、标准测试阻断共 6 个 topic | 完成含义已经由各自正文、决策或终态 task 保存；状态直接退出，不转换成 tag 或关系。 |

### Task Graph 精确动作

1. `task-000068` 仍是 waiting/idle 的当前协调事实。实施迁移报告后，使用 `task update-content` 在最新 revision 下把 `references.investigation` 改为 `docs/investigations/identify-operation-time-skill-rerouting-gap.md`，其他目标、验收、控制和关系保持不变。
2. `task-000052` 和 `task-000058` 都已 succeeded、没有父子/依赖/排斥关系，结果已经进入稳定决策和项目导航；它们不再承担协调价值，但 result 引用仍指向旧 Test Evidence 调查路径。使用 `task remove --task task-000052 --task task-000058 --results-delivered` 在同一最新 revision 下清理这两个终态 task，避免保留无法通过工具修订的失效 result 引用。
3. 所有 Task Graph 变更先运行 `runtime info`、`index info` 和 `task show`，只通过 Task Graph 工具事务化写入；mutation 后运行 `index info` 和 `task list`，再按提交范围使用 `index stage` 或普通 Git 路径选择，不手改 JSON。

Task Graph 删除的恢复来源是本次实施前的 Git commit；删除只针对上述两个已交付、无关系的终态 task，不扩大为任务清理。

### 当前维护链接

| 当前引用方 | 目标动作 |
| --- | --- |
| `docs/decisions/organize-by-main-promise-and-manage-context-association.md` | 把相关调查链接改为 `docs/investigations/recover-candidate-model-from-negative-description-dispute.md`，保留“从负向描述案例展开”的原意。 |
| `task-000052`、`task-000058` | 按上节移除已交付终态 task；稳定结果已在决策与导航中。 |
| `task-000068` | 改为 `identify-operation-time-skill-rerouting-gap.md`。 |
| `scripts/check.test.ts` 的 `current-topic/report.md` | 这是项目文件发现 fixture，不是调查引用；随根目录平铺契约改写 fixture。 |

Archived Change 中的旧路径属于历史 artifacts，不改写。两个 Codex 会话资源中的旧链接和路径文本属于形成时对话内容，5 个资源全部按 `preserveBytes: true` 迁移；它们不是当前导航，也不能为了消除历史路径命中而改写字节。残留扫描必须把 archived Change 与形成时资源分别归类，不能把它们误报为当前兼容入口。

## 长期决策闭合方案

当前 7 条 `investigation-report` active 决策均已通过 list/show/trace 恢复。实施使用下表中的最小后继集合；候选正文必须自包含，先激活全部 `拆分` 后继或按 Decision Records 支持的同一关系事务闭合，不能产生只有一个拆分后继的中间状态。

| 当前 active 决策 | 实施动作 | 后继或保持范围 |
| --- | --- | --- |
| `maintain-topic-level-investigation-index.md` | `修订` | 建立 `maintain-report-level-investigation-index.md`，改为按 Investigation ID 投影单报告与关系图。 |
| `use-fixed-investigation-record-core.md` | `拆分` | 建立 `use-single-investigation-report-core.md` 保留四项固定核心；建立 `model-investigation-evolution-as-report-relations.md` 承接报告级关系、无归档和不推断当前状态。 |
| `anchor-investigation-resources-to-topic-owners.md` | `修订` | 建立 `anchor-investigation-resources-to-report-owners.md`，owner 改为 Investigation ID stem。 |
| `exclude-investigation-resources-from-index-revision.md` | `修订` | 建立 `exclude-investigation-resources-from-report-index-revision.md`，保持资源字节退出 revision，并把引用投影改为报告级。 |
| `stage-investigation-index-entries-across-resource-changes.md` | `修订` | 建立 `stage-investigation-index-entries-by-report-id.md`，选择单位改为 Investigation ID。 |
| `warn-on-unreferenced-investigation-resources.md` | `修订` | 建立 `warn-on-unreferenced-report-resources.md`，保持未引用资源只 warning，并把 owner/scoped 边界改为报告级。 |
| `define-version-control-visible-investigation-resources.md` | 保持 | 名称白名单、Git 可见性和被引用时阻断的方向不变；把“当前索引边界”链接改为新的 report-index revision 后继。 |

新后继在领域实现和数据迁移完成前保持真实 alignment；每次 Decision Records 事务后运行严格检查。除表中 6 条被闭合的 active 前序外，不归档其余决策。

## CodeGraph 调用面与共享边界

### Investigation Report 改动面

- 身份、格式与类型：`report-path.ts`、`markdown.ts`、`timestamp.ts`、`types.ts`。
- 索引与 revision：`investigation-index-definition.ts`、`investigation-index-json-schema.ts`、`investigation-index-source.ts`、`investigation-source-revision.ts`、`investigation-state-index.ts`、`report-validation.ts`。
- 查询、检查与 CLI：`options.ts`、`query.ts`、`validation.ts`、`staging.ts`、`cli.ts`。
- 资源：`resource-reference.ts`、`resources.ts`。
- 生成和分发：`scripts/build/investigation-report.ts`、`skills/investigation-report/scripts/`、Schema、声明、source map 和 skill version。
- 测试：`tools/investigation-report/tests/` 下 6 个 `.test.ts` 文件和统一 `run.ts`；新增关系图、关系事务或 query 测试文件仍进入同一 runner。

当前 `parseInvestigationReport` 被完整/局部 validation 与 index source 同时消费；index state 和 source revision 又被 query、sync 和 stage 共同消费。因此 parser、state definition 和 source revision 必须作为一个不兼容 definition 切换，不能先保留 topic projection 再局部增加关系。

### Shared 最小 API

在 `tools/shared/src/graph/relations.ts` 建立以下领域无关表面：

1. `RelationEdge<Id, Type>`：只含 `source`、`target`、`type`。
2. `buildRelationGraph(ids, edges)`：一次构造规范 edge 列表、`edgesBySource`、`edgesByTarget` 和 ID 集合。
3. `traceRelationGraph(graph, startId, { direction, maxDepth })`：支持 predecessors、successors、both 和有界深度，输出节点集合与内部边。
4. `relationGraphStructuralIssues(graph)`：只报告 missing target、self edge、同 source/target 重复和 cycle，并返回结构化 ID/edge/cycle，不拼接领域诊断文本。

Investigation Report 在 shared 结果之上校验 formedAt 方向、六种类型、普通单前序、纯归并和多后继拆分；Decision Records 继续校验 archived target、Decision ID、决策关系类型、归并/拆分闭合和生命周期事务。`decision-relation-transaction.ts` 与 `decision-transaction.ts` 不下沉 shared；调查关系事务只复用图原语，不复用决策归档写入。

CodeGraph 显示 `traceDecisionRelations` 的直接消费链是 `decision-query-service.ts -> cli.ts`，关系一致性还由 scan、state snapshot 和 relation transaction 使用。抽取时先让 Decision Records 完整改用 shared 并通过回归，再接入 Investigation Report，避免同时维护两份泛型实现。

## Test Evidence 迁移范围

当前 Investigation Report 的 58 个最小原生入口分布如下：

| 测试文件 | 当前入口数 | 动作 |
| --- | ---: | --- |
| `cli-generated.test.ts` | 10 | 全部更新到报告级 CLI、show/trace/set-relations、生成 metadata 和 warning 契约。 |
| `index-query.test.ts` | 8 | 全部更新到新 definition、Investigation ID state、tags/relations/resourceIds 与 source revision。 |
| `parsing-directory.test.ts` | 8 | 更新根目录平铺、frontmatter、固定 H2 和 scoped check；其中 3 个旧责任按下表替换。 |
| `resources.test.ts` | 19 | 保留资源安全、可见性和 warning 责任，owner/topic/reportIndex 改为 owner report/Investigation ID。 |
| `scale.test.ts` | 1 | 继续证明 1,000 份单报告索引与查询，不生成 topic 容器。 |
| `staging.test.ts` | 12 | 保留 selected-entry staging 责任，选择单位和 fixture 改为 Investigation ID，新旧 definition 不能叠加。 |

以下 3 个 Case ID 随旧概念退出，删除旧 case 后用新的 Case ID 建立替代入口：

| 删除 Case | 新 Case 与最小入口 |
| --- | --- |
| `INVESTIGATION-INFORMATION-FIELDS-001` | `INVESTIGATION-FRONTMATTER-001` — `validation enforces report frontmatter fields and canonical ordering`。 |
| `INVESTIGATION-STRUCTURE-CHRONOLOGY-001` | `INVESTIGATION-REPORT-STRUCTURE-001` — `validation enforces one report with fixed core and optional resource section`。 |
| `INVESTIGATION-VALIDATION-FILTER-001` | `INVESTIGATION-VALIDATION-SCOPE-001` — `scoped validation selects report ids without claiming full graph proof`。 |

其余 55 个 Case ID 保留稳定测试责任；原生 test 名称、Entry、Contract、Proves 和 topic 文案按目标行为更新，不能继续声称 category、status、topic、reportIndex 或 v5 是当前契约。

新增以下 9 个最小原生入口及对应新 case：

1. `relation graph accepts independent ordinary merge and split shapes`；
2. `relation graph rejects missing duplicate self timed and cyclic edges`；
3. `relation trace returns deterministic predecessor successor and bidirectional subgraphs`；
4. `show and trace resolve reports by investigation id`；
5. `set-relations parses complete source groups and rejects ambiguous grouping`；
6. `set-relations atomically applies multi-source replacements and explicit clears`；
7. `set-relations rejects source or index drift before publishing`；
8. `set-relations restores all report and index bytes after publish failure`；
9. `set-relations leaves git pending and unrelated report fields unchanged`。

测试实现发生变化后，按 Test Evidence skill 先更新每个最小入口对应的唯一 case，再统一 `sync-index --write`；删除的 3 个 case 与新增的 12 个 case（3 个替代、9 个新增）在同一账本事务中同步。最终入口数量以实际 runner 可独立选择和报告的节点为准；若实现拆分或合并原生节点，先同步本节和 tasks，不为 helper 或 fixture 建 case。

## 写入、并发与恢复边界

1. 所有实施写入只发生在 proposal 的 Affected Owners、上述 Task Graph 精确 task 和 `migration-manifest.json` 已列出的调查/资源目标。没有外部系统写入、网络费用或敏感值落盘。
2. 调查数据迁移以 Git `HEAD` 与清单中的 source revision 为恢复来源。写入前保存目标路径集合并确认没有并行漂移；任一目标在预检后改变就停止，不继续局部迁移。
3. 迁移顺序是：长期决策候选与事务 -> shared/领域代码和测试 -> 33 份报告与 5 个资源 -> 当前维护链接与 Task Graph -> 新索引 -> 文档/生成物/Test Evidence。旧 topic 目录只在 33 份目标报告和 5 个资源均已写入、对账且严格检查通过后删除。
4. 迁移辅助逻辑只允许作为实施命令中的一次性进程代码；当前仓库不新增迁移 CLI、兼容 reader、重定向或脚本文件。实施结束后用 `git status`、`rg` 和包内容检查证明没有辅助物或旧公共表面残留。
5. `set-relations` 在一个事务中保护全部选中 Markdown 的预期文本、工作区索引原文和完整预演图。预检失败零写入；发布中失败恢复所有旧 Markdown 与旧索引，恢复失败返回逐路径诊断并停止后续写入。命令不读取或改写 Git pending。
6. 生成文件只从 `tools/` 源码和 `scripts/build/` owner 同步；不直接修补分发 MJS、声明、source map 或 Schema。

## 实施入口结论

九项 Readiness 均已闭合：目标和 owner 没有被并行 Change 改写；12 topics、33 reports、5 resources 的迁移映射和指纹已确定；状态与当前协调载体已交接；7 条 active 决策已有闭合方案；shared API、代码调用面、58 个现有测试入口、12 个替代/新增 case 责任和写入恢复边界均已固定。

当前没有需要用户选择的开放问题。下游执行者可以从 `tasks.md` 的 1.1 开始；只有源 revision 漂移、事实 owner 改变或实现证据证明目标契约不可成立时才先回写 artifacts，而不是重新讨论已经确认的关系类型、无归档边界或数据身份。
