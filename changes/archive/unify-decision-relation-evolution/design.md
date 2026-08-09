# Design

归档说明：本文保存该 change 在实施时采用的设计映射，不是现行 Decision Records 行为契约。现行 agent 行为由 [`SKILL.md`](../../../skills/decision-records/SKILL.md) 承接，完整领域不变量由 [`decision-record-rules.md`](../../../skills/decision-records/references/decision-record-rules.md) 承接；文中的“实施前基线”、目标式表述和决策对齐前提均保留实施阶段语境，完成状态见 [`tasks.md`](tasks.md)。

本设计用一个共享事务模型兑现统一关系演进，并让候选声明、CLI 覆盖和已建立关系修订都产生可预检的完整最终图。

## Context

### 实施前基线

- `tools/decision-records/src/cli-args.ts` 把 `evolve` 定义为单后继命令并拒绝其中的 `拆分` 关系；独立 `split` 接收重复 `--successor`。
- `activate` 与 `evolve` 共享单后继生命周期服务，但只有显式 CLI 关系参与前序归档；候选 Markdown 中已经存在的关系不能自然成为一次建立事务的有效输入。
- 关系图只机械检查归档目标、环路和一个前序不能恰好只有一个直接 `拆分` 后继。最终数量检查不能证明新增边来自同一次完整后继集合事务。

### 长期约束与 owner

- [统一闭合决策关系演进](../../../docs/decisions/decision-records/unify-closed-decision-relation-evolution.md) 拥有统一命令、关系策略和可恢复事务的长期方向。
- [以完整集合替换决策关系](../../../docs/decisions/decision-records/replace-decision-relations-as-complete-sets.md) 拥有候选关系、CLI 完整覆盖和已建立关系修订的长期方向。
- [闭合拆分](../../../docs/decisions/decision-records/use-closed-splits-for-coarse-decisions.md) 继续拥有一对多语义覆盖和每个后继独立对齐的规则；本 change 只改变执行入口。
- [真实案例触发重组](../../../docs/decisions/decision-records/support-reorganization-after-real-evidence.md) 继续阻止在没有实例时提前实现多对多协议。
- 兼容性边界是一次性协议切换：目标命令、参数形状和 API request 直接取代旧协议，不保留迁移层或双轨入口。

长期 owner 分工固定为：统一演进决策负责“一个关系事务允许选择哪些成员、必须满足什么拓扑、怎样写入与恢复”，完整集合决策负责“关系从哪里取得、怎样覆盖、哪些已建立字段可以改变”。本 design 只把两者映射为当前实现协议，不另行定义第三套关系语义。

## Goals / Non-Goals

目标：

- 建立一个由完整后继集合、每个后继的最终关系集合和关系策略共同定义的事务模型。
- 让 `activate` 保持低成本单后继入口，同时确保所有带关系建立都经过与 `evolve` 相同的预检、写入和恢复流程。
- 允许在不改写决策正文与生命周期的情况下修正已建立关系，并让删除、增加和闭合拓扑的后果显式可验证。
- 让未来新增关系类型只增加策略和验证，不增加同级 CLI 命令。

非目标：

- 不设计适用于所有未来拓扑的通用事务描述语言。
- 不把普通关系修订解释为决策正文的语义演进，也不绕过新决策记录要求。
- 不承诺普通文件系统上的严格原子性，不改变现有恢复手册边界。
- 不从最终 Markdown 反向证明历史上实际使用过哪一次命令。

## Decisions

### 0. 固定术语与输入归属

- “所选后继”指一次 `evolve` 中全部 `--successor` 指定的记录；路径规范化后必须互不重复。
- “来源关系”指所选后继 Markdown 当前保存的完整 `relations`。
- “关系覆盖”指本次调用显式提供的全部 `--relation`，或者由 `--clear-relations` 表达的空集合；它是应用于全部所选后继的公共输入。
- “有效最终关系”指按来源关系和关系覆盖解析后，准备写入并参与策略及最终图校验的每个后继完整关系集合。

事务成员、拓扑和恢复由统一演进决策拥有；来源关系、关系覆盖和有效最终关系的替换规则由完整集合决策拥有。后文沿用这些术语，不把“未提供覆盖”写成空数组，也不把覆盖解释成逐边操作。

### 1. 公开命令直接收敛到目标形式

目标 CLI 只保留以下关系写入形式：

```text
activate <decision-path>
  --alignment <aligned|unaligned>
  [--relation <type=decision-path>]...
  [--clear-relations]
  [--keep-unrecorded-history]

evolve
  --successor <alignment=decision-path>...
  [--relation <type=decision-path>]...
  [--clear-relations]
  [--keep-unrecorded-history]
  [--collapse-unrecorded <decision-path>]
```

`evolve` 至少接收一个 `--successor`；同一路径规范化后不能重复出现。`--relation` 与 `--clear-relations` 互斥，并且都是作用于全部所选后继的公共关系覆盖。删除 `split` 命令、`DecisionSplitSuccessor`、split lifecycle action，以及 `evolve <decision-path> --alignment ...` 形式；帮助、CLI args、公开 API 和生成声明直接反映新协议，不提供弃用期。

### 2. 先解析每个后继的有效最终关系

事务在任何写入前按下表为每个所选后继计算 `effectiveRelations`：

| CLI 关系输入 | 每个所选后继的 `effectiveRelations` |
| --- | --- |
| 一个或多个 `--relation` | 使用同一组规范化后的非空关系覆盖，完整替换各自来源关系 |
| `--clear-relations` | 使用空集合，完整替换各自来源关系 |
| 两者均未提供 | 各自使用自身 Markdown 中的来源关系 |

关系覆盖永远不是追加或合并。CLI args 必须区分“未提供关系覆盖”和“显式空集合”，不能继续把两者都归一化为 `[]`；路径规范化后重复的覆盖关系在写入前失败。

候选允许预写指向活动已建立前序的关系；候选源码查询与严格检查对其执行路径、类型、重复、自环和可解析目标等前瞻性结构检查，但不把候选边加入正式关系图，也不要求目标在候选等待期间已经归档。最终生命周期、环路和拓扑闭合只在实际建立事务的最终组合上证明。

### 3. 后继既可以是候选，也可以是已建立记录

`--successor <alignment=path>` 的 alignment 对候选表示建立后的对齐状态；对已建立记录只是选择确认值，必须与记录现有的非空 alignment 一致。候选在事务中被建立；已建立记录保留原 `status`、`alignment`、`createdAt` 和正文，只允许其完整关系集合改变。历史 `archived + alignment: null` 不进入这种普通关系修订路径。

`activate` 仍只显式选择一个目标：

- 候选没有有效关系时执行普通建立。
- 候选自身声明关系，或者调用方提供关系覆盖时，把目标翻译为单后继事务并立即执行。
- 已归档记录重新激活时继续保留既有关系和建立时间；`--relation` 与 `--clear-relations` 只适用于新候选，避免把重新激活与历史关系修订混为同一意图。

### 4. 关系策略决定允许的事务形状

事务核心按最终有效关系集合选择策略，而不是按 CLI 命令选择实现分支：

- 有效最终关系不含 `拆分` 时只允许一个所选后继；空集合表示显式清空，其余集合可以包含一个或多个、也可以混合类型的直接前序关系，继续兼容现有真实记录语义。全为 `归并` 时至少需要两个不同前序。
- `拆分` 要求至少两个显式后继；每个后继的最终关系都必须恰好是同一个前序上的一条 `拆分`。该前序事务完成后的全部直接 `拆分` 后继必须与显式选择集合完全一致，包括已经建立而本次内容不变的后继。
- 一个后继带 `拆分`、`拆分` 与其他类型混合、遗漏既有拆分后继、多个拆分前序以及当前没有策略的多后继形状都在写入前失败。
- 后续关系类型通过新增策略声明所需前序数、后继数、关系分布和闭合检查；是否需要更丰富的逐后继 CLI 输入由真实案例另行决定。

这使新增第三个拆分后继成为合法能力，但调用方必须同时显式选择原有全部后继和新候选，不能通过单后继重新挂接。这里的完整成员与拓扑要求由统一演进决策拥有，不因完整集合替换能力而放宽。

### 5. 关系变化与目标生命周期保持单向、显式

最终关系中新引用的活动已建立目标作为直接前序归档；已经归档的合法直接前序保持归档。被完整替换集合移除的旧目标不自动重新激活，也不因失去后继自动删除。正文语义改变继续通过新决策及真实直接关系表达，不能借关系修订原地改写判断。

`--collapse-unrecorded` 仍只允许一个候选后继。折叠目标、最终关系集合和未记录历史预检继续遵循现有边界；显式清空关系时由 `--clear-relations` 表达，不再借“未传 `--relation`”推断空集合。

### 6. 统一服务保持可恢复事务边界

服务层先完成以下只读准备：解析全部后继、计算有效关系、选择关系策略、验证候选或已建立状态、确定新增活动前序、检查未记录历史、构造最终记录组合并运行关系图校验。全部预检通过后才顺序应用：

1. 归档新增活动直接前序；
2. 写入所有发生变化的完整关系集合；
3. 建立候选并写入同一次事务的建立时间；
4. 从完整权威来源重建索引；
5. 读回并严格验证最终组合。

可处理失败继续恢复命令前受影响 Markdown 与索引；进程中断或恢复失败仍停止维护并进入现有恢复流程。最终 `check` 证明当前图满足结构与闭合条件，但不增加事务 ID 来证明历史命令来源。

### 7. 文档、分发与证据跟随同一协议更新

实现同步更新 Decision Records 的行为入口、固定领域契约和人类说明，移除把 `split` 作为独立 owner 的文本，明确候选关系的前瞻性校验和完整覆盖语义。Skill 独立版本递增；`tools/` 源码是实现 owner，`skills/decision-records/scripts/` 与 API 声明通过现有构建入口生成。

测试修改按 Test Evidence Review 契约逐项维护最小原生测试入口及派生索引。两条未对齐长期决策只有在代码、分发制品、稳定文档和验证全部符合本设计后才标记为已对齐。

## Risks / Trade-offs

- 允许修订已建立关系会改变历史图。通过只允许完整集合替换、禁止正文与生命周期联动、保留旧目标归档状态和最终全图校验，把它限制为显式关系纠正而不是无痕决策改写。
- 候选关系可以暂时指向活动前序，严格检查不再能仅凭单个候选证明最终生命周期闭合。候选边保持在正式图之外，建立事务必须重新读取并验证全部最终成员。
- 多后继公共 `--relation` 只适合当前共享同一拆分前序的真实形状。不同后继需要不同覆盖时依赖各自 Markdown；不为尚未出现的多对多重组提前增加复杂 CLI DSL。
- 一次性切换会破坏依赖旧 CLI 和 API 的调用方。帮助、公开声明、生成制品与协议测试必须只暴露目标形式，避免形成长期双轨维护面。
- 最终图无法证明历史事务来源。当前选择依赖受控生命周期命令和静态闭合校验，不引入会扩展 schema、索引和迁移面的事务 provenance。

## Open Questions

无。

## Test Evidence Audit

测试证据继续以 runner 能够独立选择和单独报告的 `test(...)` 为最小入口。实施按下列处置范围维护测试与一入口一 case 账本；文件、suite、脚本、fixture、helper 和断言都不是独立 case。

### 更新或重命名的入口

- 将 `split atomically replaces one coarse decision with independently aligned successors` 改为由统一 `evolve` 完成闭合拆分，并继续证明前序归档、后继独立对齐、共同建立时间和可追踪关系。
- 将 `split rejects incomplete successor sets and relationship graphs` 改为统一 `evolve` 的拆分策略门禁，并覆盖单后继、遗漏既有后继、重复成员、混合关系和未支持多后继形状。
- 更新 `evolve command archives sources and creates the aligned target atomically`、重复前序和事务回滚入口，使其使用重复 `--successor` 与完整关系覆盖协议；将 `evolve rejects archived predecessors without mutation` 改为证明合法已归档直接前序保持归档且不会被重复处理。
- 更新 `activation archives a direct predecessor and traces bounded relations` 与候选生命周期入口，分别证明候选来源关系和 `activate --relation` 都进入同一事务核心。
- 更新未记录历史与折叠入口以使用新的 successor 形式；`evolve collapse accepts an empty final relation set` 必须改为由 `--clear-relations` 明确表达空集合。
- 更新 CLI help/非法参数和生成制品入口，证明 `split`、旧 `evolve` request 与 split 专属公开类型不再暴露。

### 新增的入口

- 未提供关系覆盖时，候选来源关系成为该后继的完整最终关系。
- 公共 `--relation` 完整替换每个所选后继的来源关系，`--clear-relations` 以独立入口证明显式空集合；两者不合并成同一测试意图。
- 已建立后继可以完整替换关系，同时逐字段保留正文、`status`、`alignment` 与 `createdAt`。
- 已建立后继移除旧关系目标时，该目标不会重新激活、删除或改变对齐状态。
- 拆分事务加入新后继时，显式选择全部既有后继和新候选可以成功形成完整集合。
- 拆分事务遗漏任一既有后继时在写入前失败；重复成员、混合关系和未支持的多后继形状分别由可归因的策略门禁入口证明。
- 可处理写入失败恢复全部受影响 Markdown 与索引；恢复不完整时由独立故障入口证明维护停止并保留恢复诊断。

### 移除的入口

- 删除只证明独立 `split` 命令、旧 `evolve <decision-path> --alignment ...` 或“省略关系参数等于显式空集合”的原生入口；若其长期契约仍有效，则改名并迁移到上述目标入口，而不是保留旧协议 case。
