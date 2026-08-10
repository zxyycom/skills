# Design

本 design 保留搁置前对“现有未终态 mutation + 单任务显式终态纠正 + 新任务承接后继演进”的最近一次完整探索，并用 paused 中间态与窄 correction evidence 避免任意改写历史。Change 当前处于 `shelved`；这里的 `correct` 与 `terminalCorrections` 不是当前 runtime 行为或待实施契约。Artifact 的权威分工和恢复门禁见 [proposal.md 的 Status and Reading Contract](proposal.md#status-and-reading-contract)。

## Context

本节保存搁置方案形成时使用的概念与事实基线。当前行为必须回到 [proposal 的 Status and Reading Contract](proposal.md#status-and-reading-contract) 所列 owner 核对，不能从本节推断。

### 搁置方案中的稳定术语

| 术语 | 本 Change 中的固定含义 |
| --- | --- |
| 普通修正（ordinary mutation） | 在现有非终态生命周期内，用已有 content、control 或 relation mutation 修正当前协调事实；不会撤销终态 |
| 终态事实（terminal fact） | 当前 entry 以 `succeeded` 或 `cancelled` 表达的执行结论；`succeeded` 还包括与之配对的 current result |
| 终态纠正（terminal correction） | 原终态事实在写入时就是错误事实，因此用目标命令 `correct` 显式撤销；不是对已正确完成任务追加新需求 |
| 纠正证据（correction evidence） | `state.terminalCorrections` 中保存的窄记录，只追溯被撤销的 terminal execution、control、result、源 revision、时间和原因 |
| 当前结果（current result） | `content.result`；只表示当前 `succeeded` 事实的语义结果，不兼任历史日志或提交元数据 |
| 有效 dependent（effective dependent） | 完整 projection 中直接依赖目标 task，或因祖先 dependency 继承而依赖目标 task 的任意 task |
| 后继演进（successor evolution） | 原终态事实正确，但后来出现新目标、约束或产品方向；由独立新 task 承接 |

### 搁置方案的生命周期路由

旧方案先依据 `execution.phase` 和“原终态事实是否错误”选择路径，再进入对应设计章节。Control 与 execution 是两组独立状态；`candidate`、`queued`、`waiting`、`paused` 或 `inherit` 都不是 execution phase。下表只用于恢复旧设计，不是当前运行手册。

| 旧方案处理的状态 | 旧方案选择的路径 | 旧方案完成条件 | 旧方案章节 |
| --- | --- | --- | --- |
| `execution.phase` 为 `idle` | 使用已有 content、control 或 relation mutation；继续携带 expected revision | 当前事实修正完成，control 明确 | 搁置方案 1 |
| `execution.phase` 为 `failed` | 用已有 mutation 修正允许修改的事实；只有准备重新执行时才用 `retry` 回到 idle | 失败 execution 保留自身语义；没有伪装成终态纠正 | 搁置方案 1 |
| `execution.phase` 为 `running`，且需要修正内容或关系 | 当前 lease owner 先 `release`；lease 过期时先 recover claim，再由新 owner release。真实执行结论仍分别使用 complete、fail 或 cancel | 活动执行在自身 lease 边界内收敛；`correct` 不接管 lease | 搁置方案 1 |
| `execution.phase` 为 `succeeded` 或 `cancelled`，且该终态在写入时就是错误事实 | 先满足祖先和 effective-dependent 门禁，再调用尚未实现的目标命令 `correct`；成功后在 paused idle 中修正事实并显式选择 control | 旧终态成为 evidence，current result 已清除，任务不会自动重跑 | 搁置方案 2–4、6 |
| 原终态事实正确，只是后来出现新目标、约束或产品方向 | 创建独立 task，用 stable reference 指向来源；只有真实完成顺序成立时才增加 dependency | 原 task 及其 result、版本锚点不变，新工作拥有独立生命周期 | 搁置方案 5 |

任务图只能提供 phase、lease、关系和 result 等协调事实，不能替业务 owner 判断“原终态在当时是否错误”。这个判断是每次实际纠正的必需输入；无法确认时不得用 `correct` 猜测，应由原任务或结果 owner 先确认。

### 搁置时的状态模型与 mutation 边界

- `candidate`、`queued`、`waiting`、`paused` 和子任务可用的 `inherit` 属于 control；`idle`、`running`、`failed`、`succeeded`、`cancelled` 属于 execution。两者不能放在同一生命周期枚举中比较，candidate task 通常仍是 `execution.phase: idle`。
- 搁置时，`task update-content` 允许 idle 与 failed，拒绝 running、succeeded 和 cancelled，并通过完整 content input 重建 title、goal、acceptance、context、references 与 null result。
- `task update-control` 允许 idle 与 failed；running 只有在有效 control 完全不变时才可能通过，succeeded/cancelled 拒绝。顶层 task 始终不能 inherit。
- Parent、dependency 和 exclusion mutation 在一个 expected revision 下更新关系，并用 `assertProtectedTopologyUnchanged` 禁止任何直接或间接操作改变 running、succeeded、cancelled task 的有效祖先、children、dependency 或 exclusion evidence。
- Idle 叶子只有 projection 为 ready 时才能 claim；running task 的 renew、release、complete、fail 和 cancel 都要求当前未过期 lease。过期 lease 只通过携带旧 lease、最新 revision 与原因的 recover claim 接管，不存在 force takeover。
- Failed task 的 result 必为 null，并只通过 `retry --expected-revision` 回到 idle；retry 保留 attempt，下一次 claim 再递增。Succeeded task 必须有 result，其他 phase 必须为 null。
- Leaf complete 使用 lease；有 children 的 parent 从不 claim，只有直接 children 全部 succeeded/cancelled、至少一个 succeeded 且没有 descendant lease 时，才用 expected revision complete。
- Cancel 可以在 lease 或 expected revision 边界内递归取消非终态后代，保留已有 succeeded/cancelled 后代，并在后代持有 lease 时整笔拒绝。

### 搁置时的 Result、Git 与后继实例

- `docs/decisions/task-graph/anchor-semantic-task-results-in-index-history.md` 已确定：`content.result` 保存当前终态的语义摘要与稳定 owner 引用；首次包含该终态 entry 的 task index Git 提交提供版本锚点。Workspace mutation 和 `index stage` 都不等于 commit。
- 同一决策明确不增加 succeeded result metadata 校正命令，并把成功事实撤销交给独立终态纠正机制；failed 继续使用 retry。
- 中央 `task-000036` 已展示正确后继的当前做法：`task-000033` 正确成功后收到新要求，后续创建独立 task，用 `references.source-task` 指向来源，并在真实顺序成立时使用普通 dependency；原 result 与终态没有被重写。

### 搁置时完整图对纠正的限制

- Graph validation 已拒绝 running/succeeded task 依赖任何非 succeeded target，因此把一个 succeeded dependency 改回非终态时，仍在 running 或 succeeded 的 effective dependent 会让候选索引非法。
- Failed 与 cancelled dependent 虽不会被这一通用 invariant 拦截，却已经形成一次 execution 事实；若不先显式收敛就撤销其 dependency success，协调含义会变得含糊。
- Succeeded/cancelled ancestor 要求后代保持相应终态；纠正 child 前必须先纠正 terminal ancestor。反过来，纠正一个 terminal parent 为 paused idle 可以安全保留已终态 children，再由既有完成门禁决定后续处理。
- `projectTaskGraph` 已能给出全部 effective dependents，包括由祖先 dependency 继承的 descendants；纠正影响检查不需要持久化反向关系或第二索引。

### 已失效的实施基线与协调快照

- 搁置时记录的公开 CLI 协议是 `3.1.0`，task index 是 Schema v2；这些版本只解释旧方案，恢复时必须重新读取当前主线。
- 搁置前曾以 `changes/support-explicit-task-ids/`、`changes/add-task-tags-and-find/` 和中央 `task-000044` 作为重叠协调输入。`task-000044` 已取消，这组关系不是可恢复的实施计划；未来重新计划时必须读取当时任务图、Change 状态、版本和 owner 占用情况。

## Goals / Non-Goals

以下目标与非目标只描述搁置方案的解空间，不是当前路线图：

目标：

- 让仍在收敛的任务继续使用当前最小 mutation，不为普通编辑增加历史负担。
- 让错误 succeeded/cancelled 能被明确撤销，同时保留旧终态、旧 result 与纠正原因，且不会立即重新进入执行。
- 让纠正事务在当前权威索引上重新验证全部父子、有效 dependency、排斥与 lease 事实，不让已经运行或终结的下游静默建立在被撤销结果上。
- 让 result 保持“当前语义结果”，correction evidence 保持“显式异常纠正证据”，Git 保持版本历史 owner。
- 让正确完成后的新目标继续成为独立 task，不把 task graph 变成需求修订图或提交映射。

非目标：

- 不提供部分 JSON patch、execution phase 参数、管理员 force、批量递归 correction 或用户自定义纠正目标状态。
- 不允许普通 update-content、关系命令或 retry 直接打开终态。
- 不让 `correct` 修改 title、goal、acceptance、context、references 或 relations；这些内容只在纠正后的 paused idle 状态由现有 mutation 修改。
- 不保存普通 mutation、每次 attempt、lease renew 或 Git 操作的事件流，也不为 correction evidence 复制 commit SHA。
- 不自动创建后继 task、选择 dependency、重定向 dependents 或推断业务演进关系。

## Decisions

以下八项是搁置方案内部已经收敛的设计选择，不是活动长期决策或当前 runtime 契约。当前是否重新探索由[长期延期决策](../../docs/decisions/task-graph/defer-terminal-correction-until-confirmed-recovery-need.md)决定。

### 搁置方案 1: 普通修正继续使用现有细粒度 mutation

- Idle 与 failed task 继续使用 `task update-content`、`task update-control`、relation commands 或原子 `apply` 修正当前内容和拓扑；这些状态尚未形成受保护的成功/取消证据，不需要通用 amend 历史。
- Running task 的 content 与 topology 不可直接修正。当前 lease owner 先 `release` 到明确 control；失联且过期时仍先 recover claim，再由新 lease owner release、fail 或 cancel。纠正能力不接受 lease，也不提前接管活动执行。
- Failed 表示一次执行失败而不是不可恢复终态；继续使用 retry，不通过 correct 伪装成错误 success/cancellation。失败原因仍属于该次 failed execution，不增加 failure metadata 编辑。
- Ordinary mutation 继续携带 expected revision，execution mutation 继续使用 lease 或其现有 revision precondition。不会新增一个同时接受 revision、lease、任意 content 和任意 state 的 `amend`。

### 搁置方案 2: 新增单任务 `correct`，目标固定为 paused idle

CLI 使用：

```text
task-graph correct <task-id> --expected-revision <n> --reason <text>
```

- `correct` 只接受当前 phase 为 succeeded 或 cancelled 的 task；exactly one task、最新 expected revision 和复用既有 reason 契约的文本是固定输入。Reason 必须是首尾无空白的 1–1000 个 Unicode code points；命令不接受 `--lease`，也不读取或复用历史 lease。
- Engine 与公开 SDK 使用 `correctTask(current, options, now)` 和对应 `CorrectTaskOptions`；service 通过既有 native mutation transaction 调用。它与 complete/fail/retry/cancel 一样是 execution mutation，不加入 content/topology `TaskGraphRevisionOperation` 或 `apply`。
- 成功时保留当前 attempt，把 execution 写成 `{ phase: "idle", attempt }`，把本地 control 写成 `{ mode: "paused", reason }`，把 `content.result` 写成 null，并追加 terminal correction evidence。
- 固定 paused 而不是直接 queued：纠正只撤销错误终态，不表示内容、关系、验收与后续执行已经重新确认。调用方可以先用现有 mutation 修正事实，再显式选择 queued、inherit、waiting、paused 或 candidate。
- Parent task 也使用同一 paused idle 目标，不制造非法的 non-leaf failed phase；leaf 与 parent 都不会在 correct 后自动 claim 或 complete。
- 成功 raw data 固定为 `{ taskId, phase: "idle", control: "paused", correctedFrom, correctionCount }`；`correctedFrom` 是 `"succeeded" | "cancelled"`，`correctionCount` 是追加后的记录总数。普通 JSON envelope、错误码、退出状态与 mutation runtime 前置保持现有协议。

### 搁置方案 3: 用可选 terminal correction evidence 保存异常历史

在 `TaskState` 增加可选、存在时非空的 `terminalCorrections`：

```typescript
type TaskTerminalCorrection = {
  sourceRevision: number;
  correctedAt: string;
  reason: string;
  previous: {
    control: TaskControl;
    execution: Extract<TaskExecution, { phase: "succeeded" | "cancelled" }>;
    result: TaskResult | null;
  };
};
```

- `sourceRevision` 是纠正 mutation 读取并匹配的根 revision；`correctedAt` 使用同一 canonical transaction timestamp。记录按追加顺序保存，source revision 必须严格递增，时间不得倒退。
- Previous succeeded execution 必须配非空 previous result；previous cancelled execution 必须配 null。该语义与当前 task 的“只有 succeeded 才有 current result”独立校验。
- Previous control 被保存，因为 correct 会用 paused control 替换它；previous execution 保存 attempt 与 cancelled reason；previous result 保存被撤销的 succeeded 语义结果。Content 其他字段和 relations 不在 record 中复制，纠正 mutation 本身也不修改它们。
- 这份 evidence 只承诺从当前 entry 独立恢复“哪个终态被撤销、当时的 control/result 是什么、为什么以及何时纠正”，不承诺在没有 Git 历史时重建纠正前的完整 content 或 relations。需要完整历史审计的消费者继续读取 task index Git 历史；若其要求即使从未提交也能恢复整个旧 entry，属于扩大持久历史范围的新 Change。
- Evidence 在后续普通 mutation 和 execution transition 中原样保留；再次 correct 只追加，不覆盖旧 record。Canonical serializer 保留发生顺序并规范化嵌套 reference keys。
- 这是错误终态专属的窄证据，不是默认 event history。普通 update、retry、lease 和 Git 行为不追加记录；task 通过既有结果交付与关系闭合门禁 remove 时，evidence 随 entry 一起删除。
- 可选字段让没有纠正历史的现有 Schema v2 index 继续 canonical；新 reader 能读取旧 index。写入 evidence 后旧 runtime 会因 strict schema 拒绝该 entry，因此行为说明明确要求使用包含本能力的 runtime，不建立双 Schema 或迁移命令。

### 搁置方案 4: 在事务内拒绝尚未收敛的祖先与 effective dependents

- Correct 先基于锁内最新 candidate 重新计算 ancestors 与 `projectTaskGraph(...).tasks[taskId].dependents`，不能使用调用方先前查询的列表。
- 任一 ancestor 仍为 succeeded 或 cancelled，或任一 effective dependent 不是 idle 时，统一以 `STATE_CONFLICT` 拒绝。错误 details 固定包含 `taskId`、按 task ID 排序的 `terminalAncestors: Array<{ taskId, phase }>` 和 `nonIdleDependents: Array<{ taskId, phase }>`；没有 blocker 的数组为空。排序只保证确定输出，不表达处理顺序。
- 调用方按 parent 到 descendant 的顺序先纠正 terminal ancestors，避免 child 非终态落在 terminal parent 下。
- 任一 effective dependent 不是 idle 时拒绝，包括 direct dependency、从 ancestor 继承 dependency 的 descendant，以及 running、failed、succeeded、cancelled 四种 execution。调用方分别通过 release、retry 或 correct 把相关 task 收敛到 idle；每个动作保持自己的 lease/revision 与 evidence 语义。
- Idle dependent 无论 attempt 是否为零都可以参与最终纠正事务：source 从 succeeded 变为 paused idle 后，它会由既有 dependency projection 立即变成 incomplete-blocked；若并发 claim/complete 先发生，native lock 与最新 phase 检查使 correct 整笔失败。
- Correct 不递归修改 ancestor、dependent 或 relation，也没有 `--force`/`--cascade`。单 task transition、result 清除、paused control 与 evidence append 在一个 index revision 中原子完成；随后 `parseTaskIndex` 对完整 candidate 再验证 parent settlement、dependency evidence、exclusion、lease 与所有 Schema 语义。
- Current task 的 dependencies 在纠正后重新投影；未完成、失败或取消 dependency 会自然阻塞它。Exclusion 只在重新 queued 且 claim 时参与运行门禁，不需要纠正时改写关系。
- Correct 后若要修改错误 topology，调用方使用现有 relation mutation。其他 running/succeeded/cancelled endpoint 的 topology signature 仍受保护，必要时先按各自生命周期收敛，不能借 correct 绕过。

调用方使用以下恢复流程；每次 mutation 后都重新读取权威 index，不复用旧 projection 或旧 revision：

1. 先由结果 owner 确认原 terminal fact 错误，并准备符合 reason 契约的具体原因。
2. 读取最新 task、root revision、ancestors 和全部 effective dependents。
3. 先从 parent 到 descendant 纠正 terminal ancestors。若某个 ancestor 自身仍有 blocker，先按本流程收敛它的 blocker。
4. 把每个 non-idle effective dependent 在其自身生命周期边界内收敛到 idle：running 由 lease owner release，failed 使用 retry，succeeded/cancelled 使用 correct。存在多层 dependency 时先处理最下游 blocker，再回到当前 target；错误 details 的 task ID 顺序不能代替这一重查。
5. 再读最新 revision 和 projection；所有门禁满足后调用 `correct`。出现 `REVISION_CONFLICT` 或 blocker 变化时回到步骤 2，不盲目重放后续写入。
6. `correct` 成功后，使用已有 content 或 relation mutation 修正事实，最后在现有约束内显式选择 queued、inherit、waiting、paused 或 candidate control；顶层 task 仍不能 inherit。`index stage` 与 Git commit 仍是独立调用方动作。

### 搁置方案 5: 正确完成后的变化始终创建新 task

- 判断入口先问“原 terminal fact 在当时是否错误”。若答案是是，使用 correct；若原目标确实完成，只是后来新增目标、约束或产品方向，则创建独立 task。
- 新 task 的 `references` 使用稳定 key（例如 `source-task`）指向原 task，以便恢复语义来源；reference 不影响调度。
- 只有原 task 的完成结果确实是新 task 的执行输入时才增加 ordinary dependency。依赖表达完成顺序，不泛化成 changelog、related-to 或 evolution edge。
- 不增加 successor/supersedes/replaces relation。没有调度语义的边属于 references；若未来确有任务演进查询消费者，应以独立 change 设计，而不是让本 Change 扩张 topology 与 projection。
- 原 task 的 phase、result、correction evidence 和版本锚点保持不变；新 task 拥有自己的 lease、attempt、result 与版本锚点。

### 搁置方案 6: Result 与 correction evidence 分别形成版本事实

- `content.result` 始终只表示当前 succeeded terminal result。Correct 在同一 mutation 中先把旧 result 复制到 evidence，再清空 current result，避免旧结果继续满足“当前成功”语义。
- 原 terminal entry 已形成的 Git 版本锚点不被重写。首次包含新增 correction record 的 task index commit 只证明该仓库版本记录了纠正；不在 record 中复制该 commit SHA。
- `correct` 不查询 Git，也不要求原 terminal entry 已经形成版本锚点。若原终态从未单独提交，evidence 仍保存上述窄终态事实，但不会虚构一个 Git 锚点或完整旧 entry 快照。
- Task 后续再次 complete 时写入新的 current result；首次包含这一新 terminal entry 的 index commit 成为该次当前结果的版本锚点。Earlier correction evidence 继续可见。
- `index stage --task <id>` 继续从完整 workspace entry 构造 selected-task pending snapshot，并通过完整候选校验；correct mutation本身不 stage 或 commit。若目标测试发现现有 staging 已能保留 evidence，则不修改 staging source。

### 搁置方案 7: 保持 Schema v2，公开 CLI 做一次 minor bump

- Optional `terminalCorrections` 扩展现有 state，既有 index 不需迁移，保持 `schemaVersion: 2`。Strict schema、canonical serializer 与生成 JSON Schema 同步表达 optional-nonempty、terminal union 和 result pairing。
- `correct` command、公开 options/result/evidence types 与 service/engine export 是向后兼容的公开扩展，因此从实施任务 `task-000044` 读取的当前 CLI 协议提升一个 minor。若实施基线仍是 `3.1.0`，目标是 `3.2.0`；如主线先发生其他 protocol bump，实施者使用当时版本的下一个 minor，而不是复用已占用版本。
- Skill `metadata.version` 从实施时主线当前正整数递增一次；生成 MJS、source map、SDK declaration tree 与 task index JSON Schema 只通过现有同步入口生成。
- Default task list renderer 不增加 correction token；完整 evidence 通过 `task show` 与 JSON/SDK task entry 获取。该选择避免把异常历史塞进全量调度视图。

### 搁置方案 8: 用新长期决策建立稳定行为，不改写既有记录

- 实施时新增一份自包含 task-graph decision，说明终态纠正、paused barrier、narrow evidence、dependent/ancestor gate 与 successor task 选择。
- `anchor-semantic-task-results-in-index-history.md` 已经预留“成功事实撤销是独立问题”，本设计兑现而不改变其 result/版本锚点方向；不为分类引用伪造演进关系，也不直接改写已建立正文。
- 新 decision 在实现、Schema、行为 owner 和测试均落地后建立为 `active + aligned`，并通过 decision-records 生命周期命令同步索引。若实施审阅发现它实质改变某个当前 decision，再按当时完整直接前序集合使用正式 evolve，而不是在计划中预写无依据关系。

### 搁置方案当时未选择的备选

- 通用 amend 或 arbitrary JSON patch：会把 content、control、relations、execution、result 与 lease precondition 混成一个入口，难以证明哪些历史可以改写。
- Terminal 直接回 queued：纠正尚未修复内容/拓扑就可被 claim 或 parent complete，扩大竞态并把纠错误当重新执行授权。
- Terminal 先改 failed 再 retry：non-leaf parent 不能 failed，cancelled attempt 也未必代表执行失败，而且会把成功撤销混入 failed retry。
- 保持 succeeded 只改 result：直接违反 current-result 与版本锚点契约，且旧 dependency success 无法被撤销。
- 只依赖 Git、不保存 correction evidence：如果 correction 与重新 complete 进入同一后续提交，旧 result 与原因无法从当前 entry 独立恢复；窄 evidence 是满足显式纠正追溯义务的最小持久信息。
- 自动 cascade correction：会替调用方决定哪些上下游结果也错误，跨越 lease、任务所有权和业务授权；拒绝并返回 blocker 更安全。
- 新 successor relation：当前没有独立查询或调度消费者，stable reference 与普通 dependency 已覆盖现实场景。

## Risks / Trade-offs

以下风险只属于搁置方案；恢复时必须重新核对，不能视为完整的当前风险清单：

- Optional field 保持 Schema v2 和旧 index 可读，但一旦写入 evidence，旧 runtime 会 fail closed；生成产物、版本和行为说明必须作为同一交付集成。
- Correction records 会增加单 task entry 大小。它们只在显式错误终态发生时追加，不记录普通事件；任务失去协调价值后仍可通过既有 remove 门禁整体清理。
- 两步“correct -> 修正内容/关系 -> update-control”可能留下 paused task。Paused reason 与 task show 能直接解释状态，且比自动重新执行更安全；恢复由调用方显式完成。
- 要求所有 effective dependents 先回 idle 比通用 graph validation 更保守，但能覆盖 failed/cancelled 已经消费旧 success 的情况。复杂纠正需要按 lease/retry/correct 分别收敛多个 task，代价换取不做隐式 cascade。
- Parent/child 与 dependency 的纠正顺序不同：terminal parent 先于 child，terminal/failed/running dependent 先于 dependency target。行为说明必须明确处理顺序；错误 details 只提供确定排序的 blocker 集合，不能让调用方把 task ID 顺序当作执行计划。
- 搁置时，`support-explicit-task-ids` 与 `add-task-tags-and-find` 会修改同一 types/Schema/CLI/版本面。原实施任务 `task-000044` 已取消；未来若恢复，必须重新发现重叠工作并规划版本、optional fields 和测试合并，不能沿用旧串行关系。

## Open Questions

搁置前，旧方案内部已收敛终态来源、目标状态、evidence 最小字段、上下游拒绝条件、lease 边界、result/version anchor、后继任务策略、Schema 与协议版本策略；这只说明旧设计当时自洽，不表示它现在可以实施。

恢复前必须先证明[长期延期决策](../../docs/decisions/task-graph/defer-terminal-correction-until-confirmed-recovery-need.md)的全部重新评估条件成立，再 `resume` 并重新确认：现实案例是否仍需要终态纠正、当前 task 图和消费者要求什么、旧 `correct`/paused/evidence/门禁选择是否仍最小、当前版本与重叠 owner 如何协调，以及由哪个新任务承接实施。已取消的 `task-000044` 不能作为恢复入口。

若重新设计仍保留 `correct`，每次实际使用还需要业务或结果 owner 确认“原终态事实在写入时就是错误的”并提供原因；这是运行时事实输入，不是 Change 可以替用户决定的规则。
