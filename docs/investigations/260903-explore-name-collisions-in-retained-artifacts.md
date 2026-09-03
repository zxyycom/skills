---
title: "保留型工件的重名需要区分语义复现与身份冲突"
formedAt: "2026-09-03T07:30:22+00:00"
question: "Change、Decision 与 Investigation 的历史名称占用何时构成真实冲突，时间、短码或改名分别应承担什么责任？"
tags:
  - "artifact-identity"
  - "change-plan"
  - "decision-records"
  - "investigation-report"
  - "naming"
relations: []
---

## 形成时背景

本轮讨论起于一个跨载体问题：归档或历史记录继续占用既有 basename，可能阻止当前 Change、Decision 或 Investigation 使用最自然的语义名称。候选方案先后包括复用归档名称、追加随机短码、使用独立 UUID、按名称查询并在重名时消歧、增加 rename 命令，以及直接把时间加入名称。

讨论随后发现，三个载体只有路径冲突相似，产品语义并不相同：Investigation 保存一轮形成时认识，时间天然属于报告；Decision 可能在经历中间判断后重新采用早先方向，需要表达一次新的决策发生；独立 Change Plan 的 archive 只保存计划快照，不像 OpenSpec archive 那样同时把 delta spec 同步到稳定事实。若不先区分这些结果，统一短码、UUID 或 rename 只会在路径层移动问题。

本报告固定使用以下术语：

| 术语 | 本报告含义 |
| --- | --- |
| 语义名称 | 人用来表达“这份工件主要在说什么”的 basename 主体，例如 `investigate-name-collisions`。 |
| 实例 ID | 能精确选择一份工件的完整 basename；当前 Decision 和 Investigation 的 ID 包含 `.md`。 |
| 形成事件 | 某轮调查、决策或实施计划在特定上下文中被创建或建立的事件。 |
| 重名 | 两份不同实例使用相同语义名称；它可能合法，不等于实例 ID 冲突。 |
| 历史名称占用 | 旧实例使新实例无法直接使用同一个完整 basename。 |

截至形成时，仓库没有 active 与 archived Change 同名实例。本轮针对未来契约，不是修复已经发生的数据损坏；除建立和优化本报告外，没有修改三个领域的身份、关系、归档或 rename 行为。

## 调查目的

本报告供后续维护 Change Plan、Decision Records 或 Investigation Report 的设计与实施 agent 使用。目标 agent 应从本文先判断目标领域是否存在**合法重名**，再选择时间化 ID、复用、rename、discard 或删除 archive；不得把本文的候选方案误作已经生效的长期决策。

预期使用结果是：

1. 能区分同一对象、错误名称、无保留价值对象和同主题新实例；
2. 能解释 Decision 方向回归为什么可能需要新节点；
3. 能为三个领域分别提出最小方案，而不是默认建设共享 UUID、短码 allocator 或 rename 平台；
4. 能列出实施前仍需确认的时间语义、兼容范围和真实消费者。

本轮具体回答：

1. Change、Decision 和 Investigation 中“重名”分别可能表示什么，哪些情况才是真实身份冲突；
2. 时间能否作为比随机短码更有语义的实例区分，并在哪些领域足以成为主要命名组成；
3. 同一条 Decision 演进链上再次出现同名、同方向记录时，它是在重复旧决策，还是在记录新的采用事件；
4. rename 命令能解决哪些历史名称占用，为什么它不能替代对合法重名的建模；
5. 独立 Change Plan 的 archive 当前产生什么结果，是否值得继续让它影响当前名称空间；
6. 哪些结论已经由当前契约支持，哪些仍需要真实使用证据或后续设计决定。

本轮不修改 CLI、索引 Schema、关系类型或生命周期，不创建 Change 或长期 Decision。文中的命令形状和 ID 示例用于说明责任，不是稳定接口；任何实施仍需由对应领域 owner 建立 Change 与长期判断。

## 调查范围与依据

本轮以 2026-09-03T07:30:22+00:00 的工作区状态为形成时点，实际检查以下行为 owner：

1. [`change-plan` 固定契约](../../skills/change-plan/references/change-plan-contract.md)规定 Change 根目录直属成员为 active、`archive/` 直属成员为 archived；归档把目录移动到同名目标，目标已存在时拒绝。Archived Change 没有 stage，不再由 checker 解释，只能由 `list` 和 `show` 发现或读取原始 artifacts。
2. [`Decision Records` 固定规则](../../skills/decision-records/references/decision-record-rules.md)规定含 `.md` 的 basename 是全集合稳定 Decision ID，active 与 archived 共用统一索引和 ID 空间；关系从新记录指向直接前序，完整图必须无环。重新激活保留原 `createdAt` 和既有关系，不借重新激活修改关系；改 basename 本来就是身份变化，选择性暂存也要求以旧、新 ID 显式表达改名。
3. [`Investigation Report` 固定契约](../../skills/investigation-report/references/investigation-report-contract.md)规定 basename 是正式集合唯一 Investigation ID，每份报告必须保存带时区的 `formedAt`，所有未 discard 的正式报告留在同一集合，并以从新报告指向前序的无环关系表达补充、复查、修正等认识演进。Investigation 没有 archive lifecycle。
4. [`OpenSpec Change 归档`](../../skills/openspec-archive-change/SKILL.md)要求归档前检查 delta spec，并默认由 OpenSpec CLI 同步 spec；只有用户明确选择 `--skip-specs` 时才跳过。这证明 OpenSpec 的 archive 不只是目录搬移，而独立 Change Plan 的 archive 没有对应稳定事实同步结果。
5. [`项目工具链`](../tooling.md)明确排除 `changes/archive/**` 的持续 Markdown 链接校验，并把归档目录描述为 Change Plan 历史参考；这进一步限定了当前归档内容的维护和消费强度。

形成时集合包含 6 个 active Change、34 个 archived Change、325 条已建立 Decision 和 36 份正式 Investigation。对 active 与 archived Change basename 做集合交集，结果为空。通过 Investigation 索引按 `ID`、`名称` 和 `归档` 查询，没有找到直接回答本问题的既有报告，因此本报告使用空前序关系。

本轮同时使用本次对话作为需求与场景证据，特别是以下判断输入：名称是主要的人类语义入口；随机 UUID 或全局短码会增加记忆负担；时间对形成时记录具有直接解释力；同一决策回归时，简单重新激活可能无法表达新的关系事件；独立 Change archive 的价值不能仅由 OpenSpec 的外形类比推出。

证据边界如下：

- 没有统计 archived Change 的实际读取频率或引用者；
- 没有构造 Decision 的“采用 A、改为 B、再次采用 A”CLI 实验；
- 没有验证独立工作树并发创建时间 ID；
- 没有调查仓库外系统对 basename 的引用；
- 没有验证时间格式、迁移事务或名称查询的实现成本。

因此，删除 Change archive、增加 Decision 新关系语义、确定时间粒度和新增 rename 命令仍属于架构推断与建议，不是已经验证的行为要求。

## 调查结果与边界

### 结论摘要

三个领域不应采用同一解决方案：

| 领域 | 合法重名的主要含义 | 当前优先方案 | 暂不采用 |
| --- | --- | --- | --- |
| Investigation | 同一问题在不同时间、版本、证据或范围下再次调查 | 用 `formedAt` 的规范时间投影区分实例；名称查询允许返回多份报告 | 全局 UUID、只因重名改旧报告名称 |
| Decision | 经历中间判断后，再次作出相同或近似方向的决定 | 新建具有新形成时间的决策节点，继续指向当前直接前序；必要时在正文说明重申早期方向 | 把旧节点直接连回后继形成环、默认建设 activation episode 模型 |
| Change | 同一语义名称再次用于新的 active 实施计划 | 先复核 archive 是否还应存在；若完成后删除并依赖 Git，则只要求 active 名称唯一 | 为被动 archive 先建设跨历史 ID 系统 |

Rename 是三者的辅助维护动作：它解决错误名称和格式迁移，不解决同主题新形成事件。随机短码只在规范时间仍发生实际目标冲突时作为局部兜底，不作为首选身份语义。

### 重名判断顺序

同一名称再次出现至少有四种不同含义：

| 情况 | 判断 | 合适动作 |
| --- | --- | --- |
| 实际仍是同一个对象，且当前模型能够继续使用它 | 没有产生新身份 | 继续使用；只有不丢失演进事件时才重新激活 |
| 旧名称当时就不准确，或记录发生纯身份命名错误 | 名称维护问题 | rename，并同步领域内索引、关系和资源 |
| 旧记录不应继续保留，且满足无引用与删除门禁 | 集合成员问题 | discard 或受控删除，不用改名伪装保留 |
| 同一主题在新时间、条件、证据或实施轮次下形成新结果 | 合法重名 | 保留共同语义名称，用时间或其他实例成分区分 |

处理请求名称时按表格从上到下判断。同一对象不创建新记录；旧名称错误才 rename；对象不应保留才 discard；只有第四类创建新实例并分配新的完整 ID。

若某领域能证明名称必须跨全部历史唯一，而且任何再次出现都只能是复用、修正或删除，则不需要时间或短码。当前 Investigation 的复查语义已经构成反例，Decision 的方向回归也可能构成反例。

按名称查询应被理解为发现同一语义名称族，可以返回多个结果；完整 basename 继续承担精确选择。不能因为调用方希望名称查询只返回一项，就把历史实例改名成不再忠实的名称。

### 时间化 ID 的共同边界

时间与随机短码不同，它可以解释“为什么这是另一份记录”：形成环境已经变化，认识、判断或实施轮次在另一个时点发生。完整 ID 可以使用“语义名称 + 规范 UTC 时间”，例如：

```text
investigate-name-collisions-20260903t073022z.md
adopt-artifact-identity-policy-20260903t081510z.md
```

尾部使用固定格式可以保留 name-first 的文件树和命令体验，也允许工具从新格式中恢复语义名称。时间不需要脱离名称全局唯一；创建命令仍须在本领域完整成员集合中检查最终 ID，不覆盖现有对象。

时间不能提供数学上的无限唯一，也可能受时钟、并发工作树和人为回填影响。当前规模不要求直接升级为 UUID：使用秒级 UTC、目标存在检查，并在同名同秒实际冲突时失败或追加局部序号即可。时间字段或 lifecycle metadata 继续是时间事实 owner；ID 中的紧凑时间只是便于识别和避免重名的投影，不能反向改写正文时间。

现有无时间 ID 可以继续作为 legacy ID 读取。是否批量迁移取决于真实查询或冲突压力；新格式不应自动触发全量历史重命名。

### Investigation：以 `formedAt` 区分认识形成

Investigation 的一个节点本来就表示一轮形成时认识。相同问题在不同时间、代码版本、证据或范围下重新调查时，应建立新报告，并使用 `复查`、`补充`、`修正` 或其他真实直接前序关系。因此同名报告具有明确含义，不应通过修改旧名称消除。

建议的新建行为是：

1. 调用方提供语义名称和现有必填 `formedAt`；
2. CLI 从同一个 `formedAt` 生成紧凑 UTC 后缀，形成 `<name>-<time>.md`；
3. `show <investigation-id>` 继续精确读取一份报告；
4. 新增或扩展名称查询，返回相同语义名称的全部报告，并显示 `formedAt`、完整 ID 和直接关系；
5. 同名同秒目标已存在时不覆盖，要求调整真实 `formedAt` 或生成局部序号。

这里 `formedAt` 仍由 frontmatter 拥有；basename 时间必须与其一致，或者明确只作为创建时投影并由检查器验证不漂移。当前证据更支持前者，因为 Investigation 已有精确形成时间，无需再引入第二个时间概念。

### Decision：同名后继表示再次作出或重申

设早期决策 A 采用方向 X，后继 B 改为方向 Y，之后环境变化又选择 X：

```text
A(X) <- B(Y) <- C(X)
```

如果 A 仍是当前判断，且背景、范围、理由和方向都没有变化，那么新建 C 没有长期信息增量，应继续使用 A 或不做任何动作。如果 B 已经改变当前判断，后来的 C 即使采用与 A 相同的方向，也记录了一个新的事实：维护者在经历 Y 及新的上下文后再次选择 X，并让 B 退出当前依据。C 的核心价值是“再次作出或重申的事件”，而不是创造新命题 X。

直接重新激活 A 只能恢复旧节点及其原 `createdAt`、正文和关系。若再把 A 指向后来的 B，会与 B 到 A 的既有路径成环；若不增加关系，则图中没有这次从 B 返回 X 的事件。为关系添加 activation episode、有效时间区间或边级元数据可以表达同一节点多次生效，但会把当前记录 DAG 扩展为决策命题与采用事件的双层模型，查询、对齐、归档和演进事务都需要重新定义。

在没有已确认消费者需要复用同一命题节点前，较小的模型是建立 C：

1. C 保留与 A 相同或相近的语义名称，并获得新的时间化 ID；
2. C 以当前直接前序 B 为演进 target，使用符合实际含义的现有关系；
3. C 的正文完整重述当前采用方向、当前理由，并说明它重新采用了 A 的方向；
4. A、B、C 继续组成无环的形成事件链。

此时同一链路上的同名明确表示“方向回归或重申”。如果未来消费者需要机器识别 C 与 A 的命题等价，可以另行评估不参与 lifecycle DAG 的 `reaffirms` 引用或新的关系语义；不能为了避免两份相似正文，先引入 activation episode、有效时间区间或边级状态。

Decision 的时间来源仍需单独决定。当前 candidate 在建立前 `createdAt: null`，因此不能直接声称 ID 时间就是建立时间。最小候选是让 ID 时间表示 candidate 记录形成时间，`createdAt` 继续拥有正式建立时间；更强但更复杂的候选是由 `activate/evolve` 在建立时分配最终 ID。实施前必须选择其一，不能让 agent 从 ID 猜测 lifecycle 时间。

### Rename 是必要维护能力，但不是合法重名的主要出口

当前 Decision 和 Investigation 都已经把 basename 变化视为身份变化，并要求派生索引同步；因此增加 rename 命令不会首次引入“改名需要维护索引”这一成本。可靠 rename 应保留时间后缀，只改变语义名称，并事务化更新该领域拥有的对象：

- Decision：文件位置、关系 target、索引键、`sourcePath` 和来源 revision；
- Investigation：正式或 candidate 文件、关系 target、索引键、来源 revision、resource owner 路径及领域内资源链接；
- Change：目标 active 目录及工具能够确认的直接位置事实；仓库外引用继续作为未覆盖边界。

Rename 适用于名称错误、格式迁移或 owner 重划。具体命令应先 preflight 目标占用与引用范围，失败时零写入；已经进入 Git 历史的身份迁移是否需要额外确认，由各领域现有删除和演进门禁决定。

Rename 不能解决第四类合法重名。如果旧记录当时名称正确，只因新实例需要相同名称就改写旧 ID，会用当前分配需求扭曲历史，并让每次方向回归、报告复查或 Change 重开都先制造一次旧记录迁移。对于“过往名称占据当前名称”，应先按前述四类判断：同一对象则复用，错误名称则 rename，不应保留则 discard，新形成事件则使用带时间的新 ID。

### Change：先判断是否需要 archive，再讨论历史重名

独立 Change Plan 当前归档后不再参与结构检查、stage、Git 距离或持续链接维护，也不把结果合入稳定 spec；它只保留可由 `list --archived` 和 `show` 发现的原始计划快照。与之相比，OpenSpec archive 默认同步 delta spec，目录移动只是完成状态转换的一部分。用户关于两者不可类比的判断得到当前仓库 owner 支持。

这不证明 Change archive 一定应删除。原始 proposal、design 和 tasks 仍可能服务实施审计、复盘或未参与原任务的读者；但当前契约没有说明谁持续消费这些快照、需要保留多久，以及 Git 历史为什么不足。

当前优先候选是把核心生命周期收敛为 `active/draft -> active/plan -> completed`，并让完成动作在以下条件成立后删除 Change 目录，而不是移动到 archive：

1. Plan 结构、基线和全部 checkbox 通过现有门禁；
2. agent 已核对成功标准、稳定 owner、长期 Decision 和验证证据；
3. Change artifacts 已进入可用 Git `HEAD`，避免尚未记录的计划被删除；
4. 完成命令输出被删除目录和 Git 基线，不把删除误报为历史不可恢复。

在该候选下，Git 保存计划演进，稳定事实进入项目 owner，长期判断进入 Decision，具有独立复核价值的形成时认识进入 Investigation。完成后的 Change 不再占用当前名称；同名 active Change 仍应视为需要确认的计划冲突。既有 `changes/archive/` 可以作为 legacy 历史只读保留，再根据真实使用证据决定批量删除或继续支持发现。

如果后续证据证明团队确实直接消费 archived artifacts，则保留 archive，并让新 Change 使用时间化名称；不能一边把 archive 定义为无需检查的纪念目录，一边为它建设三领域共享身份基础设施。

### 当前结论

1. **已确认事实**：三类载体的当前 ID 都由路径 basename 或目录名承担；Decision 关系和 Investigation 关系依赖稳定 ID；Investigation 必有形成时间；独立 Change archive 只移动和保留 artifacts，而 OpenSpec archive 默认还承担 spec 同步。
2. **架构推断**：Investigation 的重复名称通常代表不同时点的认识形成；Decision 在存在中间后继时重新采用旧方向，最好理解为新的决策发生，并用新节点保持演进图无环；Change archive 当前价值不足以驱动复杂身份能力。
3. **建议方案**：Investigation 使用 `formedAt` 派生的时间化 ID；Decision 新形成记录使用时间化 ID，并以新节点表达方向回归；Change 优先评估完成后受控删除并依赖 Git。随机短码只兜底同名同秒冲突，rename 只负责名称纠错和格式迁移。
4. **待验证事项**：确定 Investigation ID 时间与 `formedAt` 的一致性规则；决定 Decision ID 时间表示候选形成还是正式建立；验证方向回归是否需要机器可查的 `reaffirms`；收集 archived Change 的真实消费者和引用证据。
5. **实施顺序**：先验证 Change archive 消费者；再分别为 Investigation、Decision 建立领域 Change 和长期 Decision；最后才判断 rename 是否存在足够跨领域共同责任。不得从本报告直接修改三个 CLI。
6. **实际动作与边界**：本轮只建立并优化本调查报告，没有修改任何既有 ID、关系、索引 Schema、归档行为或 CLI。报告中的方案尚未成为长期决策或实施授权。
