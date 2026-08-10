# Proposal

本 proposal 保留 task-graph 终态纠正方向在搁置前最后一次确认的提案快照。它用于未来重新评估时恢复当时的目标、范围和验收设想，不表示当前准备实现终态纠正。

## Why

### Status and Reading Contract

本 Change 以 [.change-plan.json](.change-plan.json) 为阶段事实源，当前处于 `shelved`。本文、[design.md](design.md) 和 [tasks.md](tasks.md) 只保存搁置前最近一次确认的方案；其中的 `correct`、`terminalCorrections` 与相关输出既不是当前 runtime 行为，也不是待执行契约。

是否重新探索终态纠正，只由[长期延期决策](../../docs/decisions/task-graph/defer-terminal-correction-until-confirmed-recovery-need.md)中的触发条件决定。实际 task-graph 行为以 [task-graph skill](../../skills/task-graph/SKILL.md)、[人类说明](../../docs/skills/task-graph.md)和 [`tools/task-graph/src/`](../../tools/task-graph/src/) 为准。未来即使满足重新评估条件，也必须先 `resume`、按当时事实重新确认 `plan`，再决定是否形成新的实施任务；不能直接按本 Change 实施。

三个 artifact 的职责如下：

| Artifact | 权威内容 | 使用方式 |
| --- | --- | --- |
| `proposal.md` | 搁置前的目标结果、范围、成功标准和影响面 | 恢复旧提案的主承诺；不据此判断当前应实施 |
| `design.md` | 搁置前的生命周期选择、公开契约、事务门禁和取舍 | 作为重新设计的调查输入；不把旧状态路由当作当前操作入口 |
| `tasks.md` | 搁置前的实施顺序、验证节点和完成证据设想 | 识别旧方案维护面；未勾选项不是 backlog 或执行授权 |

### 搁置前识别的问题

搁置前的设计基线中，task-graph 已为未终态任务提供内容、control 与关系 mutation，为运行任务提供 lease 所有权下的 release、fail、cancel 与 complete，并让 failed task 通过 retry 回到 idle。`succeeded` 与 `cancelled` 则会封闭普通 mutation，以防内容、拓扑和 result 被静默改写。

旧提案把潜在变化分为三类：

1. 未终态任务的目标、上下文或关系仍在收敛，调用方需要在现有 revision 与 lease 边界内修正当前协调事实。
2. 已写入的 succeeded 或 cancelled 事实本身错误，必须撤销当前终态、清除当前 result，并保留原终态与纠正原因。
3. 原任务已经正确完成，后来出现新的需求或产品方向；这属于后继演进，不应重开或改写原任务。

旧提案据此判断：通用 amend、任意 state patch 或 metadata-only result 更新会让活动 lease、父子完成门禁、依赖成功证据、排斥关系和 Git 版本锚点失去可信度；如果未来确有必须撤销的错误终态，则应保留普通 mutation 的职责，只探索窄而显式的纠正入口。当前长期决策尚未确认这种现实需要，因此没有采用或实施该入口。

## Outcome

以下内容是搁置方案当时设想的目标结果，不是当前产品承诺：

- 未终态内容、control 和关系继续使用现有细粒度 mutation；running task 必须由当前 lease owner 先 release，过期 lease 仍先通过既有 recover claim 接管，不增加 force mutation。
- 新增一个只接受 succeeded 或 cancelled 的 `correct` mutation。它要求最新 expected revision 和非空原因，不接受或复用旧 lease；成功后保留 attempt，把任务改为 `idle + paused`，清除当前 result，并追加原终态证据。
- 终态纠正记录保存纠正前的 terminal execution、control、result、源 revision、时间和原因。旧 succeeded result 只作为 correction evidence 存在，不再是当前语义结果；后续重新完成时写入新的当前 result。
- 纠正事务在写入前重新检查完整父子与有效 dependency 投影。终态祖先尚未纠正，或任一有效 dependent 仍为 running、failed、succeeded 或 cancelled 时整笔拒绝；调用方先把受影响任务收敛到 idle，再重试最新 revision，不提供 cascade 或 force。
- 原任务正确完成后出现新目标时创建新 task，用稳定 reference 指向来源；只有真实完成顺序成立时才增加普通 dependency。不会新增没有调度语义的 successor relation，也不会重写原 result 或版本锚点。

## Scope

以下范围只描述实现搁置方案可能涉及的维护面，不授权修改这些 owner。

旧方案纳入范围：

- 明确 candidate/queued/waiting/paused control 与 idle/running/failed/succeeded/cancelled execution 的现有修改矩阵，以及 content、control、parent、dependency、exclusion、lease 和 result 各自的 owner。
- 在 task state 中增加可选、非空、按发生顺序保存的 terminal correction evidence，并保持没有纠正记录的既有 Schema v2 index 可直接读取。
- 为源码 engine、service、公开导出与 CLI 增加 `correct`，固定 expected revision、reason、终态来源、`idle + paused` 目标状态、result 清除与返回结果。
- 在同一事务内重算有效 dependents、祖先、父子门禁、依赖、排斥和完整 Schema/graph 语义，拒绝会让已执行上下游继续依赖错误事实的纠正。
- 保持 retry 只处理 failed、release 只处理当前 running lease、cancel 只表达取消、complete 只建立当前 succeeded result；不让这些动作互相替代。
- 同步 task-graph 行为 owner、人类说明、长期决策、CLI 协议版本、skill 独立版本、生成 bundle、source map、SDK 声明与 task index JSON Schema。
- 新增或更新原生测试，并按 test-evidence-review 契约维护一入口一 case；同步受新能力修订的既有“终态不可 reopen”测试证据。

旧方案非目标：

- 不增加通用 task patch、任意 state rewrite、force lease takeover、批量 cascade correction 或绕过 expected revision 的管理员入口。
- 不允许 succeeded result 在保持 succeeded phase 时原位修改，也不把 `correct` 用作摘要、reference 或提交 SHA 的 metadata 校正命令。
- 不把 terminal correction 扩展成所有 mutation、lease、attempt 或 Git 操作的通用事件日志；普通历史继续由 task index 的 Git 历史承接。
- 不改变 failed retry、过期 lease recover claim、父任务完成条件、任务删除门禁、`index stage` 与 Git commit 的职责分工。
- 不为正确完成后的新需求增加 successor、supersedes、replaces 或 evolution 拓扑边，不自动重定向既有 dependency。
- 不回溯清理或改写历史 task result，也不修改当前中央 task index 作为本 Change 的计划产物。

## Success Criteria

以下标准是旧方案的候选验收条件；当前没有实施结果可以按这些条件判定完成：

1. 行为说明和实现明确区分 control 与 execution：candidate 是 idle task 的控制状态而不是执行阶段；idle/failed 可以按现有规则修改，running 必须先在 lease 边界内释放，普通 mutation 仍不能改写 succeeded/cancelled。
2. `correct <task-id> --expected-revision <n> --reason <text>` 只接受 succeeded 或 cancelled，拒绝 lease 参数、空原因、陈旧 revision 和其他 phase；成功后保留 attempt、写入本地 paused control、把 execution 改为 idle、把当前 result 置 null，并返回确定的纠正摘要。
3. 每次终态纠正追加一条 canonical evidence，至少保存源 revision、纠正时间、原因，以及纠正前的 control、terminal execution 与 result；succeeded evidence 必须含旧 result，cancelled evidence 必须保持旧 result 为 null，重复纠正不覆盖更早记录。
4. correction evidence 在 update-content、update-control、关系修改、claim、release、fail、retry、cancel、complete 和再次 correct 中按契约保留；重新 complete 只写新的当前 result，旧 result 仍只能从 correction evidence 与 Git 历史追溯。
5. 纠正事务只在全部祖先非终态且每个有效 dependent 都为 idle 时成功，并在最终 candidate 上重新执行完整 graph/Schema 校验。运行、失败、成功或取消的 direct/inherited dependent、终态祖先、父子完成冲突和 revision 竞争均整笔拒绝且不留下部分状态。
6. 纠正后的 paused 状态不能被自动 claim 或父任务自动 complete；调用方可以用现有 update-content、update-control 与关系 apply 修正事实，再显式选择 queued/inherit 等本地 control。其他受保护 running/succeeded/cancelled task 的拓扑证据仍不能被关系 mutation 改写。
7. 正确完成后的新需求继续创建独立 task；稳定 reference 只表达来源，dependency 只在原结果确为后续输入时使用。原 task 的 result、terminal phase 与首次终态索引提交版本锚点保持不变。
8. Schema v2 既有 index 保持可读；公开 CLI 做一次 minor protocol bump，源码 API、CLI help、JSON envelope、生成 SDK、JSON Schema、分发 bundle、行为说明、长期决策、skill 版本、原生测试和 test-evidence 账本保持同一契约。
9. 目标 task-graph 测试、生成漂移检查、决策记录严格检查、test-evidence 严格检查和仓库完整检查通过；搁置前曾计划由 `task-000044` 与重叠的 task ID、tags/find plans 串行协调。`task-000044` 已取消；恢复时不得复用这项历史协调结论，必须按当时任务图新建实施任务并重新判断 owner 冲突。

## Affected Owners

以下列表是旧方案的潜在影响面，不表示这些 owner 已发生变化：

- `skills/task-graph/SKILL.md` 与 `docs/skills/task-graph.md`：未终态修正、lease 边界、终态纠正、后继演进、result 与版本锚点的稳定行为说明。
- `tools/task-graph/src/types.ts`、`schema.ts`、`engine.ts`、`graph.ts`、`service.ts`、`cli.ts` 与 `index.ts`：公开类型、持久 evidence、纠正事务、影响检查、命令与导出。
- `tools/task-graph/src/staging.ts`：原则上复用完整候选校验；只有目标测试发现 correction evidence 无法按现有 selected-task 语义暂存时才修改。
- `scripts/build/task-graph.ts`、`skills/task-graph/scripts/` 与 `skills/task-graph/references/task-graph-index.schema.json`：现有生成边界及其机械产物；不直接手改生成文件。
- `tools/task-graph/tests/` 与 `docs/test-evidence/task-graph/`：最小原生测试入口、现有终态封闭 case 的语义修订、新 correction cases 与统一派生索引。
- `docs/decisions/task-graph/` 与 `docs/decisions/decision-index.json`：若未来实际实施，再保存“错误终态显式纠正、当前 result 与 correction evidence 分离、正确完成后使用新 task”的长期判断；当前这里只引用已生效的延期决策。
- `changes/support-explicit-task-ids/` 与 `changes/add-task-tags-and-find/`：搁置前只作为共享 owner 的协调输入。旧实施任务 `task-000044` 已取消；未来计划必须重新确认相关 Change 是否仍存在、CLI minor、skill version 与 Schema/type 如何组合。
