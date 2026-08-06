# Design

本设计以独立 `task-graph` 分发单元、仓库级嵌套字典索引和事务化 JSON 工具兑现 proposal，并固定实施所需的 schema 语义、父子规则、状态机、并发协议和清理边界。

## Context

已确认的长期方向：

- [`own-short-lived-task-orchestration`](../../docs/decisions/task-graph/own-short-lived-task-orchestration.md) 确认 `task-graph` 拥有短期任务图，持久 change 和代理委派继续由既有 owner 管理。
- [`use-authoritative-json-index-for-short-lived-tasks`](../../docs/decisions/task-graph/use-authoritative-json-index-for-short-lived-tasks.md) 确认长期存在的是权威 JSON 容器，task 是无需独立 Markdown 或永久归档的短期条目。
- [`key-task-identity-and-separate-content-state-projection`](../../docs/decisions/task-graph/key-task-identity-and-separate-content-state-projection.md) 确认嵌套字典键承接身份与作用域，内容、显式状态和查询投影彼此分离。
- [`model-task-topology-and-inheritance-explicitly`](../../docs/decisions/task-graph/model-task-topology-and-inheritance-explicitly.md) 确认父子、依赖、排斥及继承语义必须显式维护。
- [`coordinate-task-execution-with-transactional-claims`](../../docs/decisions/task-graph/coordinate-task-execution-with-transactional-claims.md) 确认共享索引通过 revision、事务领取和执行租约协调执行。

当前 owner 与实现边界：

- `tools/index-runtime/` 拥有从其他事实源生成并查询派生索引的协议，只提供派生 revision 新鲜度与原子替换，不拥有权威可变状态、跨进程 CAS、运行租约或陈旧执行恢复。
- `tools/shared/src/version-control/` 的写入边界专门拥有 Git `pending` 范围替换，不能作为普通 JSON 运行态存储使用。
- 当前仓库没有第二个与 task index 共享相同事务、租约和恢复语义的消费者，因此第一版在 `tools/task-graph/` 内实现专用 mutable-state store，不扩展 `index-runtime`，也不提前建立共享 owner。
- 仓库规则要求 `tools/` 保存随 skill 分发的工具源码，`scripts/` 保存构建适配，`skills/` 保存行为本体和实际分发内容；新增测试时同步维护测试证据账本。

文档权威与阅读顺序：

1. 上述五条 `task-graph` 决策拥有长期方向；实现不得在 change 中静默改写这些方向。
2. `proposal.md` 拥有本次 change 的目标、范围和成功标准；本文件拥有兑现 proposal 的当前实施设计和协议选择。
3. `tasks.md` 拥有实施顺序和进度；checkbox 不改变决策状态，也不单独构成实施授权。
4. `skills/task-graph/SKILL.md` 交付 agent 行为、工具源码与生成 schema 交付精确机器协议、`docs/task-graph/task-graph-index.json` 交付当前运行事实并完成验证后，五条决策才可标记为 `aligned`；任一事实 owner 尚未交付时均保持 `unaligned`。

本文统一使用以下术语：

- `task index`：位于 `docs/task-graph/task-graph-index.json`、由工具独占写入并长期存在的仓库级权威 JSON 文件。
- `task scope`：task index 中隔离一组相关任务的字典 entry；scope 是容器而不是 task，可以包含多个顶层任务。
- `task entry`：`scopes[scopeId].tasks[taskId]` 中一个真实、短期任务的紧凑 JSON 记录。
- `顶层任务`：`parentId` 为 `null` 的真实任务；scope 不创建虚拟 root task。
- `显式状态`：task entry 中持久保存的 control、execution、relations 和 timestamps。
- `有效投影`：工具根据完整索引查询生成且不写回 task entry 的有效状态、继承来源、反向关系、阻塞原因和下一动作。
- `blocker`：阻止 task 当前下一动作的结构化原因；至少包含稳定类型、涉及的 task ID 和声明来源或继承路径，不以自然语言 message 代替机器字段。
- `actionable task`：有效状态为 `ready` 且当前存在合法下一动作的 task；叶子 task 的下一动作是 `claim`，已满足完成门禁的父 task 下一动作是 `complete`。
- `短事务锁`：只保护一次索引读取、变换、验证和原子替换的跨进程文件锁。
- `执行租约`：在实际工作期间证明当前领取尝试仍拥有某个 task 的运行状态；它不等于短事务锁。

## Goals / Non-Goals

目标：

- 为单个仓库内一个或多个短期 task scope 提供唯一、可恢复和可并发更新的权威状态。
- 让 scope、task 和关系可按稳定 ID 直接查找，同时让任务内容、控制状态、执行状态和复杂有效投影保持分区。
- 让每个真实父任务通过子任务完成门禁收敛，让子任务继承祖先软控制和硬约束而不复制祖先执行状态。
- 让 agent 从 JSON 工具获得 actionable 集合、有效状态和完整阻塞理由，并只能通过受控事务改变状态。
- 让 skill 与 CLI 组成一个完整分发单元，同时保留与其他 skills 的可选交接而不建立隐含安装依赖。

非目标：

- 不设计长期项目管理产品、跨设备同步、通知、日历、人工团队权限或跨项目任务服务。
- 不把完整执行计划、长篇上下文、过程日志或永久历史塞入 task entry。
- 不使用事件溯源、永久 tombstone、单 task GC 或父任务完成摘要物化支持提前删除。
- 不让工具根据自然语言、工作区 diff 或未记录偏好自动建立拓扑、优先级或最优并行集合。
- 不在第一版建立资源锁语言、跨 scope 关系、后台回收、静默 schema 迁移或共享 mutable-state 基础设施。
- 不承诺跨主机或网络共享文件系统并发；第一版的锁 owner 与进程存活判断只覆盖同一主机上的共享工作区。

## Decisions

### 分发与 owner

- Skill 稳定身份和源码目录使用 `task-graph`；同名工具源码位于 `tools/task-graph/`。
- 构建后的 JSON CLI、公开声明、linked source map 和 task index JSON Schema 进入 `skills/task-graph/scripts/` 或 `skills/task-graph/references/`，并与 skill updater 组成同一分发单元。
- 专用 mutable-state store、短事务锁和租约恢复留在 `tools/task-graph/`；只有未来出现第二个责任和失败语义相同的真实消费者时才评估提取共享 owner。

### 索引位置与 Git 边界

- 默认索引路径固定为相对仓库根目录的 `docs/task-graph/task-graph-index.json`；CLI 接受显式 `--root`，并为测试或宿主集成保留显式 `--index` 覆盖，不使用隐含环境变量改变事实源。
- 索引是仓库当前短期任务运行事实，不是逐任务长期文档；索引文件可以进入版本管理，但 task-graph 工具不自动 stage、commit 或判断何时提交。
- 只有索引 JSON 是长期工作区内容；相邻 lock directory、临时文件和陈旧锁隔离路径使用固定可识别前缀，由工具尽力清理并通过仓库 `.gitignore` 排除，不能成为第二运行事实或分发输入。
- 顶层持久保存 `schemaVersion`、单调递增的整数 `revision`、永不回退的 scope/task 下一 ID 计数器 `nextIds` 和 `scopes` 字典。清理 task 或 scope 不回退 revision 与 `nextIds`。
- Scope ID 使用 `scope-<十进制编号>`，task ID 使用全索引唯一的 `task-<十进制编号>`；编号至少六位并以 `0` 左补齐，超过六位后自然扩展。分配时使用当前 `nextIds` 值并在同一事务中加一，失败事务不消耗编号，已经分配的 ID 永不复用。字典 key 是身份，entry 内不重复保存相同 ID；执行租约使用不可预测的独立 lease ID。
- 所有时间使用带毫秒的 UTC RFC 3339 文本。测试通过注入 clock 验证时间相关行为，领域逻辑不直接读取不可替换的系统时间。

### 嵌套字典与 task entry

索引的规范形状如下；精确长度、pattern 和判别联合由实现中的 Valibot Schema 及其生成 JSON Schema 拥有：

```json
{
  "schemaVersion": 1,
  "revision": 19,
  "nextIds": {
    "scope": 3,
    "task": 18
  },
  "scopes": {
    "scope-000002": {
      "key": "create-task-graph",
      "bindings": {
        "codex-thread": "thread-000042"
      },
      "timestamps": {
        "createdAt": "2026-08-06T08:00:00.000Z",
        "updatedAt": "2026-08-06T08:30:00.000Z"
      },
      "tasks": {
        "task-000017": {
          "content": {
            "title": "实现 task index schema",
            "goal": "提供严格解析和确定性序列化",
            "acceptance": [
              "非法字段被拒绝",
              "序列化结果固定"
            ],
            "context": null,
            "references": {},
            "result": null
          },
          "state": {
            "control": {
              "mode": "queued",
              "reason": null
            },
            "execution": {
              "phase": "idle",
              "attempt": 0
            },
            "relations": {
              "parentId": null,
              "dependsOn": {},
              "excludes": {}
            },
            "timestamps": {
              "createdAt": "2026-08-06T08:10:00.000Z",
              "updatedAt": "2026-08-06T08:10:00.000Z"
            }
          }
        }
      }
    }
  }
}
```

- `scopes` 和每个 scope 的 `tasks` 使用按稳定 ID 索引的字典；所有实体查询使用 `scopes[scopeId].tasks[taskId]`，不依赖数组扫描恢复身份。
- `nextIds.scope` 和 `nextIds.task` 表示下一次可分配的正安全整数，不表示当前最大已分配 ID；规范空索引的两个值均为 `1`。
- 每个 `nextIds` 值必须严格大于索引中同类 ID 的全部数值后缀；解析、`check` 和每次 mutation 都验证该不变量，不能根据现存条目静默重算计数器。
- 每个 scope 的 `key` 是创建后不可变的稳定短名称，`bindings` 是按 binding kind 查找宿主任务或线程的可选字典；同一开放索引中的 scope key 和非空 binding 对必须唯一。开放 scope 可以在 expectedRevision 下设置或移除 binding，候选完整索引仍须满足唯一性。
- `content` 只保存 `title`、`goal`、`acceptance`、短 `context`、外部 `references` 字典和紧凑 `result`；result 只能由完成操作写入，长篇背景与长期结果交给稳定 owner。
- `state` 只保存 control、execution、显式 relations 和 timestamps。未知字段、非法 key、非规范 ID、跨 scope 引用和不符合判别联合的组合全部拒绝。binding 与 reference key 使用最多 80 个 ASCII 字符的 kebab-case，并将 `constructor`、`prototype` 和 `__proto__` 列为拒绝使用的保留字；raw request/index/result 在 Schema 解析前拒绝这些 own key，避免运行时把它们静默丢弃。Apply alias 是独立的瞬时身份，不受这组持久字典保留字限制。
- 新建顶层 task 默认使用 `control.mode: candidate`，新建子 task 默认使用 `control.mode: inherit`，两者的 execution 均从 `idle`、`attempt: 0` 开始；调用方可以在同一创建事务中显式选择其他合法 control，但不能直接创建 running 或终态 task。
- `dependsOn` 与 `excludes` 使用以 task ID 为 key、`true` 为值的字典集合。`excludes` 的两个 task entry 必须完全对称，由工具在一个事务中同时维护。
- `parentId` 是父子关系的唯一持久方向；children、dependents、排斥来源、继承展开和其他反向关系只在查询时投影。
- 规范序列化固定字段顺序、LF 和末尾换行；scope、task、binding、reference 及关系字典按 key 字典序输出，具有语义顺序的 acceptance 内容保持输入顺序。

### Control、execution 与有效状态

- `control.mode` 的最小集合是 `inherit`、`candidate`、`queued`、`waiting` 和 `paused`。顶层任务不能使用 `inherit`；子任务的有效 control 取自身或最近祖先的首个非 `inherit` 值。
- `candidate` 表示已经记录但尚未选入执行，`queued` 表示已经选入当前调度，`waiting` 表示显式等待外部输入或事件，`paused` 表示可恢复暂停。`waiting` 和 `paused` 必须提供非空原因；`inherit`、`candidate` 和 `queued` 不保存原因。
- `queued` 只表达 task graph 内调度意图，不授予用户未授权的文件、外部系统或不可逆操作权限。
- `execution.phase` 的最小集合是 `idle`、`running`、`succeeded`、`failed` 和 `cancelled`。运行、成功、失败和取消只属于当前 task，不向子任务复制。
- Execution 使用 phase 判别联合：只有 `running` 保存且必须保存一个执行租约，只有 `failed` 保存当前失败原因，`cancelled` 保存紧凑取消原因，其他 phase 不保留这些互斥字段。`attempt` 是非负整数，只在成功 claim 时增加；父任务可以在 attempt 为 `0` 时通过完成门禁进入 `succeeded`。
- 工具投影的有效状态最小集合是 `candidate`、`waiting`、`paused`、`ready`、`running`、`recovery-needed`、`succeeded`、`failed` 和 `cancelled`。`queued` 根据有效约束投影为 `ready` 或 `waiting`。
- 有效状态按以下优先级确定，命中后不再执行更低优先级规则：
  1. `execution.phase` 为 `succeeded`、`failed` 或 `cancelled` 时，有效状态与 execution phase 相同。
  2. `execution.phase` 为 `running` 时，有效租约投影为 `running`，过期租约投影为 `recovery-needed`。
  3. `execution.phase` 为 `idle` 时，先从当前 task 向祖先解析最近的非 `inherit` control；`candidate`、`waiting` 和 `paused` 分别投影为同名状态，并返回 control 来源与原因。
  4. `execution.phase` 为 `idle` 且有效 control 为 `queued` 时，叶子 task 在全部硬约束满足后投影为 `ready` 并给出下一动作 `claim`；有子任务的父 task 在完成门禁满足后投影为 `ready` 并给出下一动作 `complete`；其余情况投影为 `waiting` 并返回全部 blocker。
- `actionable` 查询只返回上述 `ready` task，不把 `candidate`、显式或派生 `waiting`、`paused`、`failed`、`recovery-needed` 或终态 task 混入结果。一次查询结果必须带产生该视图的 revision；后续写操作仍按 revision 或 lease 规则重新验证。
- `succeeded` 和 `cancelled` 是不可 reopen 的终态；需要继续工作时创建新 task。`failed` 必须显式 `retry` 回到 `idle`，或显式 `cancel`。
- `succeeded` 和 `cancelled` task 的 content、control、execution、显式 relations 与直接 children 集合均不可再改变；不能通过新增、删除或重挂子任务破坏已经成立的父任务完成证据。
- 运行 task 的 control 或内容不能由普通 revision 编辑静默改变；执行者只能通过匹配 lease 的 `release` 清除运行态并选择合法的下一本地 control，或通过完成、失败和取消结束本次领取。
- 任一 control 修改都先重算受影响后代的有效 control；如果会改变 `running` 或 `recovery-needed` task 的有效 control，事务拒绝。只影响 idle task 或被更近本地 control 覆盖的后代时可以按 expectedRevision 提交。

### 真实父子任务与完成门禁

- Scope 只隔离任务，不创建 root task；一个 scope 可以包含多个 `parentId: null` 的顶层真实任务。
- 每个 task 都是真实目标，不保存 `work`、`group` 或其他虚拟任务类型。没有子任务的 task 可以被 `claim`；拥有一个或多个子任务的 task 表示自身已经被分解，不能直接领取。
- 给 task 增加第一个或后续子任务只允许在父任务当前 `execution.phase` 为 `idle` 时发生；此前的领取历史和非零 attempt 不构成额外屏障，因此 task 经合法 `release` 或失败后显式 `retry` 回到 `idle` 后可以分解。运行、失败或终态父任务不能增加子任务。
- 叶子 task 的 `complete` 必须匹配活动 lease。父 task 使用同一个 `complete` 操作，但要求自身 `execution.phase` 为 `idle`、有效 control 为 `queued`，并以 revision 为前置条件；所有直接子任务必须为 `succeeded` 或 `cancelled`、至少一个直接子任务必须为 `succeeded`，且不存在活动或待恢复后代租约。操作重新验证全部条件并写入父任务紧凑 result。
- 任一直接子任务的 `execution.phase` 不是 `succeeded` 或 `cancelled` 时都会阻止父任务完成。全部直接子任务均取消时，父任务只能取消或增加替代子任务，不能成功。
- 父任务仍需直接执行的一段工作必须表示为真实子任务，避免父任务在持有长租约期间等待其他子任务。
- 取消有子任务的父任务默认在一个事务中递归取消全部尚未终结且不处于 `running` 或 `recovery-needed` 的后代，同时保留已经 `succeeded` 或 `cancelled` 的后代；存在活动或过期未恢复租约时整笔取消失败。成功父任务因完成门禁已经拥有全部已收敛后代，不产生成功祖先与未完成子任务并存。

### 层级、依赖、排斥与继承

- `parentId` 在 scope 内形成无环森林；`dependsOn` 在加入祖先继承和父任务完成约束后仍必须形成 DAG；`excludes` 对称、无自环且只能引用同一 scope。
- 子任务的有效依赖是自身及全部祖先显式 `dependsOn` 的并集。依赖目标只有在 `succeeded` 时才满足；`failed` 和 `cancelled` 都产生不可自动消除的阻塞。
- 两个 task 的任一自身或祖先之间存在显式 exclusion 时，这两个 task 即存在有效排斥。排斥只禁止同时运行，不建立完成顺序。
- 关系写入必须拒绝继承展开后的自依赖、依赖环、自排斥、祖先与后代排斥，以及同一对 task 同时存在 dependency 和 exclusion 的冗余组合。
- 子任务可以用本地 control 覆盖祖先软控制，也可以增加局部依赖和排斥；control 覆盖不能删除祖先依赖、祖先排斥或终态屏障。
- 任何 parent、dependency 或 exclusion 修改都先计算候选完整图；如果它会改变任一 `running`、`recovery-needed`、`succeeded` 或 `cancelled` task 的有效祖先、依赖或排斥集合，事务拒绝。运行或待恢复 task 必须先完成、失败、释放或恢复；终态 task 的执行证据不得通过后续拓扑编辑改写。
- 查询必须返回有效 control 的来源 task、完整 blocker 集合、依赖与排斥的声明来源和继承路径，以及 children、dependents 和下一合法动作；这些投影不写回索引。

### Skill 执行流程与交接

- 当用户明确要求维护 task graph，或当前工作同时存在多个短期任务且涉及候选集合、动态追加、父子分解、非线性依赖、并发排斥或跨上下文恢复时，skill 进入 task-graph 流程。只有少量按固定顺序执行的步骤时继续使用当前对话计划，不因“有多个步骤”自动创建 scope。
- 进入流程后先执行 index 信息与完整检查，再通过显式 scope ID、唯一 scope key 或 binding 恢复既有 scope；只有不存在匹配 scope 时才创建新 scope。索引缺失时使用 `init` 创建规范空索引，不直接手写 JSON。
- Agent 只把已经能从用户要求、稳定 owner 或明确工作事实确认的 task 和关系写入索引；尚未选入执行的真实任务使用 `candidate`，缺少会改变关系或授权的信息时保持候选或显式等待并向用户暴露缺口。工具不从自然语言自动补关系。
- 每轮调度先读取当前 revision 和 actionable 投影，再由 agent 或用户选择具体 task；执行实际工作前必须成功 `claim`，长任务在租约有效期内 `renew`，结束时使用匹配 lease 完成、失败、释放或取消。revision 冲突后重新读取和判断，不盲目重放旧视图。
- `queued` 只表示 task-graph 内的调度选择。文件写入、外部系统调用、不可逆操作、子代理创建及其他行为仍分别受当前用户授权和对应 owner 约束；lease 的 actor 只是协调标识，不是权限凭据。
- 需要长篇背景、正式设计、长期理由或跨阶段交接时，将稳定内容交给 `change-plan`、决策记录或其他事实 owner，task entry 只保存摘要与引用。需要创建或审计代理时，把已就绪 task 的目标、验收、约束和 lease 边界交给 `subagent-orchestration`；没有该 skill 时仍可在当前 agent 中顺序执行。
- 任务结果已经交付且 scope 满足关闭门禁后才执行 scope close；关闭前把需要长期保留的结果写入稳定 owner。Skill 不把 scope 删除或 checkbox 状态解释为用户已验收。

### Revision、短事务锁与原子替换

- 所有写命令通过相邻固定 lock directory 获取跨进程短事务锁。锁元数据至少包含不可预测 owner token、同主机进程身份和更新时间，并先写入 owner-token 专属临时文件、完成同步后再原子发布；正常获取最多等待 5 秒。新创建但元数据尚未完整发布的 fresh lock 视为获取窗口并继续重试，不能立即按损坏锁处理。锁超过 60 秒只成为陈旧候选，工具只有在能够确认记录的同主机 owner 进程已经失效时才进入恢复选举；已经越过 fresh 窗口的元数据损坏、owner 仍存活或存活状态无法确认时返回稳定恢复错误，不按时间单独偷锁。
- Canonical lock directory 恰好包含一个 generation owner 文件：未认领时为 `owner-<O>.json`，已认领时为 `owner-<O>.claimed-by-<R>.json`，后者必须同时存在 metadata 与文件名完全匹配的 `reclaimer-<R>.json`。陈旧锁回收者先以 `wx` 发布自己的唯一 `reclaimer-<N>.json`，再把它实际读取的精确 owner generation 文件原子 rename 为 `owner-<O>.claimed-by-<N>.json`；只有该精确 rename 的胜者能够继续，失败者只清理自己成功创建的 reclaimer 文件。已崩溃的 stale claimed generation 也按 `claimed-by-<R>` 到 `claimed-by-<N>` 的精确 rename 接管，不能先清除共享标记或退回仅按 owner token 判断。
- 胜者在隔离 canonical directory 前核对 claimed owner 与自己的 reclaimer generation，rename 到唯一 quarantine 后再次核对同一 generation，再尽力删除。`wx` 碰撞者不得删除既存 reclaimer；owner、claimed owner 或 reclaimer 的非法 JSON、缺失、符号链接和无法确认的进程状态都返回稳定恢复错误。任何从 directory 观察到读取、认领或隔离的竞态都必须重新读取 canonical generation；旧观察者不得隔离后来发布的 fresh owner。
- 短事务锁只覆盖读取当前文件、解析与校验、检查 revision 或 lease 前置条件、构造候选状态、验证完整候选图、序列化、原子替换和读回验证；实际任务执行绝不持有文件锁。
- 锁 owner 在替换与释放前必须验证当前 lock directory 仍包含自己获取时记录的精确 owner generation 文件，且该文件的 metadata owner token 与 handle 匹配；任何可等待 hook 或文件操作之后、真正 replace 或 release isolation 之前都重新验证。释放时把已验证的 canonical lock directory 原子 rename 到唯一 quarantine，再尽力清理；提交后的释放隔离失败按未知写入结果处理，提交前操作失败又无法释放时返回稳定恢复错误并保留原操作诊断。陈旧锁隔离会使旧 owner 的后续写入失效；回收者取得新锁后必须重新读取索引和 revision，不能沿用回收前视图。
- `init` 只允许以 `schemaVersion: 1`、`revision: 0`、两个 `nextIds` 均为 `1` 且 `scopes` 为空的规范内容独占创建不存在的索引；目标已经存在时返回稳定错误，绝不覆盖或隐式重置现有事实。
- 除 `init`、在锁内重验最新状态的 `claim` 和以当前 lease 为前置条件的执行操作外，所有写命令都必须携带 `expectedRevision`；这包括 scope/task 创建、批量 apply、content/control/关系修改、父任务完成、重试、非运行态取消和 scope 清理。取得锁后当前 revision 不匹配时返回可重试冲突且不写入。
- `claim` 不依赖调用方旧 revision，而是在锁内读取最新索引并重新验证叶子身份、有效 control、依赖、祖先屏障和正在运行的排斥任务。执行后续操作使用当前 lease ID，而不是普通 revision 覆盖。
- 除 `init` 外，每次成功写入把 revision 增加 1。原子替换是事务提交点：提交点前的锁冲突、验证失败或写入失败不改变 revision、`nextIds` 或任何 task；原子替换调用抛错后必须读回判定，仍为旧 revision 表示未提交并返回可重试写入失败，已经是候选新 revision 表示写入已提交但本次响应结果未知，其他 revision 或无法读取同样视为未知。提交后的读回或响应失败不能宣称未写入，必须返回稳定的 `WRITE_OUTCOME_UNKNOWN` 类错误和预期 revision，要求调用方先运行信息与检查查询，不能盲目重试 mutation。
- 写入在目标文件同目录创建 `wx` 唯一临时文件，且只有本次 `open(wx)` 成功后才拥有并可清理该路径；既存同名文件导致创建失败时不得删除它。完成写入和文件同步后执行一次原子替换，再读回核对 revision 与规范文本；只读查询不取短事务锁，只会观察提交点前或后的完整文件。索引、lock directory、generation metadata 与临时路径必须拒绝符号链接边界，避免显式 root/index 解析到未预期目标。
- `check` 只读取和报告，不自动修复、覆盖或迁移损坏索引。未知 schemaVersion 明确失败；第一版不预建无现实输入的迁移框架，未来版本通过显式 `migrate` 契约处理。

### 执行租约与恢复

- `claim` 把叶子 task 从 `idle` 事务化转为 `running`，增加 attempt，并写入包含全索引唯一 lease ID、actor、claimedAt、renewedAt 和 expiresAt 的执行租约；生成器碰撞在写入候选 execution 前以可重试 `LEASE_CONFLICT` 拒绝，存量索引中的重复 running lease 由完整语义检查拒绝。
- 默认租约时长为 30 分钟；公开输入允许 1 分钟至 24 小时。`renew` 必须在租约有效期内匹配当前 lease，并从当前时钟重新计算 expiresAt。
- `complete` 和 `cancel` 必须且只能提供 `leaseId` 或 `expectedRevision` 之一，再按叶子/父任务及运行/非运行状态验证所选前置条件；两者同给或都不给均在领域与 CLI 边界以参数错误拒绝。`complete`、`fail`、`release` 和运行中 `cancel` 必须匹配当前且尚未过期的 lease；租约过期后只能进入受控 recover 流程。`release` 清除运行租约并显式选择下一本地 control；可选值覆盖 `inherit`、`candidate`、`queued`、`waiting` 和 `paused`，但仍遵守顶层 task 不得 `inherit` 以及等待或暂停必须带原因的规则。`fail` 保存当前紧凑失败原因但不保存 attempt 历史。
- `retry` 只把 `failed` task 恢复为 `idle`，清除当前失败原因并保留累计 attempt 与现有 control；它不直接领取任务。取消保存紧凑原因并清除当前 lease，终态 result 与失败原因的精确判别联合由公开 Schema 固定。
- 租约过期不会自动释放 task 或排斥边界；有效状态变为 `recovery-needed`，继续阻止重复领取和排斥任务运行。
- 过期租约的 `recover` 必须指明当前 lease ID，在锁内重新确认它仍是当前且已经过期的租约，再把任务转成 `failed` 并保存 lease 失效原因；之后必须显式 `retry` 或 `cancel`。活动租约的提前强制恢复必须同时提供当前 revision、明确 `force` 和原因，不能由另一个 agent 静默覆盖。

### JSON CLI 与批量事务

- CLI 不提供 `--json` 或人类文本模式。每次正常调用只向 stdout 输出一个 JSON 对象；可预期的参数、schema、状态、冲突、租约和文件失败也输出稳定 JSON 结果。stderr 只保留 CLI 无法进入协议入口或输出 JSON 前发生的非预期故障。
- 成功结果固定包含 `ok: true`、当前 index path、`revision: number | null` 和 `data`；读取或修改索引的成功返回当前 number revision，help、version 等未打开索引的协议成功返回 `null`。失败结果固定包含 `ok: false`、可读取时的当前 revision，以及含稳定 `code`、`retryable`、`message` 和结构化 `details` 的 error。
- `ok: true` 对应进程退出码 `0`，已经进入 JSON 协议的 `ok: false` 对应退出码 `1`；只有 CLI 在构造 JSON 结果前发生的启动级故障使用退出码 `2` 并写入 stderr。stdout 的 JSON 对象以 LF 结束，协议内不得混入日志、usage 或进度文本。
- 简单操作使用显式子命令和类型化参数；复杂初始建图与多关系更新使用 `apply` 接收一个 stdin 或显式文件中的 JSON request，在一个 expectedRevision 下原子执行全部 operations，并返回调用方 alias 到生成 task ID 的字典映射。
- 第一版入口至少覆盖 index 初始化、信息和检查，scope 创建、列表、显示、binding 更新和关闭，task 创建、批量 apply、显示、列表、内容与 control 更新，parent/dependency/exclusion 维护，actionable 查询与 trace，以及 claim、renew、release、complete、fail、retry、cancel 和 recover。
- Help、version 和参数 usage 也属于 JSON 协议：能够进入 CLI 的请求必须返回同一成功或失败 envelope，不调用 Commander 或运行时的默认文本输出。
- 工具返回所有逐 task 结果时使用以 task ID 为 key 的字典；确有拓扑顺序的独立结果可以额外返回 ID 数组，但数组不承担实体身份查找。
- 工具可以同时返回多个 individually actionable task 及其潜在排斥边；它不提供 `claim-next`、业务优先级或最优独立集选择。多个执行者竞争相互排斥的 ready task 时，第一个成功 claim 的事务使后续 claim 在最新状态下失败。

### 实施时必须固定的局部契约

以下内容由任务 1.1 和 1.2 在公开 TypeScript 声明、Valibot Schema、生成 JSON Schema 与对应测试中一次固定，不需要用户再次选择，因此不构成 Open Question：

- `content`、scope key、binding、reference、result、actor、reason 和 lease 字段的精确类型、必填性、长度上限与 pattern。
- 每个 CLI 子命令的规范名称、参数、stdin/file request 判别联合、响应 `data` 形状，以及完整稳定 error code 目录与 `retryable` 映射。
- blocker、trace、actionable、next action 和 alias 映射的精确机器结构，以及所有无业务顺序集合的确定性排序规则。
- `tools/task-graph/` 内部模块与测试文件布局，以及生成产物在允许目录中的精确拆分。

这些局部选择必须遵守本设计已经固定的状态、拓扑、事务、权限与 owner 边界，并在任务 1.3 开始前形成单一机器真源。实现时如果必须改变持久字段、状态集合、关系含义、错误恢复、默认路径、权限或清理门禁，应先更新对应长期决策或本 change，而不能把变化隐藏在 Schema 或 CLI 命名中。

### Scope 清理与 Git 生命周期

- 第一版不删除单个 task。终态 task 与其结果、关系和父任务完成证据保留到整个 scope 关闭，避免为提前删除物化消费标记或聚合历史。
- Scope 关闭要求所有顶层任务为 `succeeded` 或 `cancelled`，完整 scope 中不存在 `running`、`recovery-needed` 或 `failed` task，并由调用方显式确认结果已经交付给用户或稳定 owner。
- `scope close` 在一个 expectedRevision 事务中删除 scope 及其全部 task；revision 增加且 scope/task `nextIds` 保留，不复用已经清理的 ID。
- `gc` 查询返回全部 scope 按 ID 排序的 closable 状态和结构化 blocker。GC mutation 必须显式提供非空且不重复的 scope ID 集合，并为每个 scope 提供 `resultsDelivered: true`；工具在同一 expectedRevision、短锁和原子替换中先验证全部选择，再以 all-or-nothing 方式删除，成功只增加一次 revision 且保留 `nextIds`。单 scope `close` 与批量 GC 复用同一个 `closeScopes` 领域原语，但保持各自边界语义；不提供后台任务、默认保留窗口或根据查询或时间静默删除。工具不自动 stage 或 commit 清理前后的索引状态。

## Risks / Trade-offs

- 把频繁变化的权威索引放在 `docs/task-graph/` 会持续产生工作区 diff；这是让 agents 在仓库内共享可发现事实的代价。工具不替用户决定 Git 提交边界，实施和提交整理必须区分运行态索引与其他项目改动。
- 单文件与全局 revision 简化了原子事实源，但不相关 scope 的并发更新也可能产生 CAS 重试；第一版优先正确性与可恢复性，不增加分片或增量协议。
- 嵌套 scope/task 字典改善已知 ID 查找，但跨 scope 全局查询和反向关系仍需在内存中建立临时映射；这些映射只服务一次读取，不形成第二份持久索引。
- 祖先继承降低关系重复，却使有效状态解释更复杂；完整来源和阻塞路径是必要输出，图测试必须覆盖多层继承和重挂父节点。
- Pairwise exclusion 可能在大量资源冲突时产生多条边；第一版没有证据支持资源锁语言，因此保持显式 task ID 关系。
- 执行租约使用墙上时钟，需要通过注入 clock 和明确过期恢复限制时钟敏感行为；任务执行超过租约时必须主动续租。
- 同主机进程存活检查让自动陈旧锁回收保持保守；owner 存活状态无法确认时会停止写入，需要维护者先处理对应进程，不能以可用性换取双写风险。
- 原子替换之后仍可能遇到读回或响应故障；明确的未知提交结果会增加一次查询恢复，但避免调用方把已经提交的 mutation 当作未执行并盲目重放。
- 不保存永久历史降低维护面，但会失去 task 级审计；需要长期回放的目标、理由、证据和结果必须在 scope 关闭前交给已有稳定 owner。

## Open Questions

无。
