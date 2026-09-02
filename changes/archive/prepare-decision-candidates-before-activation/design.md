# Design

本 design 将 Decision candidate 的创建、正文机械 readiness、语义审核、只读事务预检和正式建立分成可独立判断的阶段，并让预检与真实生命周期命令复用准备逻辑而不共享确认。

## Context

- 当前 Decision Records 已有 `candidate` lifecycle，但固定规则要求候选摘要、正文和关系完整可审核；`activate/evolve` 才写入 alignment、createdAt、正式索引和最终关系事务。
- Candidate、active 与 archived 共用一个决策根和统一扫描；candidate 排除于持久索引，但严格检查、查询、discard 和生命周期准备仍会读取它。
- Decision ID 与根目录位置是稳定身份。创建必须避免 candidate、active、archived 和并发写入之间的覆盖或短暂半文件可见性。
- `separate-maintenance-diagnostics-from-mutation-outcomes` 已建立：共享层提供原因，Decision Records 事务拥有 mutation scope/outcome，CLI 即时渲染；普通 readiness 和只读预检失败不得伪造 mutation 结果。
- `separate-reviewable-candidates-from-established-decisions` 当前要求 candidate 完整可审核。本 Change 落地后需要 successor Decision 修订候选内部边界，但正式索引与正式关系图仍只包含 established records。
- 本 Plan 只拥有本次预期调整与验证顺序。当前事实继续由 Decision Records skill、固定规则、Decision Records 与维护源码拥有；实现发现事实不同时先修订本 Plan。

## Goals / Non-Goals

目标：

- 让维护者用一次 `new` 写出规范 metadata 和可继续编辑的固定正文骨架。
- 让候选创建的成功不被预期的正文不完整或辅助预检 attention 伪装成失败。
- 让编辑后的候选可以用真实生命周期参数重复执行只读 preflight，再由正式命令独立复核和建立。
- 让严格检查、查询和输出清楚区分机械 readiness、语义审核与授权。
- 让创建、同步、生命周期和丢弃共享集合安全边界，不暴露半写或覆盖竞争身份。

非目标：

- 不自动生成或补全目的、背景、决策正文、关系语义和 alignment 判断。
- 不保存 preflight receipt、revision token、确认参数、自动重试状态或持久诊断。
- 不让 `new`、read-only preflight 或 Git pending 建立决策、改变 lifecycle 或写正式索引。
- 不让 CLI readiness 证明正文质量、长期记录门槛、关系真实性、当前事实对齐或维护授权。
- 不为新入口建立 JSON CLI 协议、日志、遥测或新的共享错误分类。

## Decisions

### Intended Change

#### 阶段与事实边界

候选路径固定为：

```text
显式 metadata 参数
  -> 集合锁内原子、不覆盖地建立 scaffold
  -> 报告 creation 与机械 body readiness
  -> 可选运行当时可确定的辅助 preflight
  -> 人工或 agent 编辑和语义审核
  -> activate/evolve --preflight 重复预检完整选择
  -> 非 preflight 的 activate/evolve 重新读取、授权并建立
```

CLI 和公开结果只表达三类机器事实：

| 维度 | 含义 | 不证明 |
| --- | --- | --- |
| `scaffoldValid` | 身份、位置、frontmatter、tags、关系语法和固定章节形状合法 | 正文已经完成或判断正确 |
| `bodyReady` | 固定正文非空、至少一个 `采用`，并满足其他机器正文规则 | 已完成语义审核或应当建立 |
| `preflight` | 当前参数和当前集合下可完成的关系、图、索引与 Git 历史检查结果 | 稍后状态、确认继承或写入授权 |

“reviewable”“已审核”“可建立”只用于 agent 完成语义判断后的任务结论，不保存为扫描字段。正式 `activate/evolve` 的机器门禁要求 `scaffoldValid + bodyReady`；skill 另外要求语义审核和当前授权。

#### `new` 命令

`new` 接收一个规范 Decision ID、title、purpose、background、decision、至少一个 tag 和零个或多个直接 relation。精确选项名、重复参数形式和排序由 `help new` 固定；实现不从自然语言、正文、目录或 Git 历史推断 metadata。

Alignment 不是 candidate metadata。`new` 只提供可选的 `--preflight-alignment <aligned|unaligned>`；省略时输出 `alignment-unresolved`，仍预检不依赖 alignment 的关系形状、目标、图与历史维度。提供时只补足当次索引投影，不写入文件，也不转交给后续命令。

`new` 的处理与退出固定如下：

| 阶段 | 处理 | 退出与写入 |
| --- | --- | --- |
| 输入与目标安全 | 参数、ID、字段、tag/关系结构、集合路径和跨 lifecycle 身份冲突 | 参数错误退出 `2`，其他失败退出 `1`；不创建目标 |
| scaffold create | 集合锁内重读身份，以完整临时内容执行原子且不覆盖的目标发布 | 失败退出 `1`；不得留下目标或半写文件 |
| body readiness | 读取已发布 scaffold 并报告机械正文状态 | 新 scaffold 预期为 `incomplete`，不改变成功状态 |
| auxiliary preflight | 使用显式 metadata、可选 alignment、当前正式基线和 Git 基线预演可确定维度 | attention、warning、selection-incomplete 或 unavailable 写入即时诊断，但 scaffold 已创建时命令退出 `0` |

创建成功写 stdout；readiness 与 preflight finding 写 stderr。`new` 结果中嵌套的 `preflight: attention` 只是创建后预览事实，不构成顶层 `DecisionApplicationAttention`，因此不把成功创建改成退出 `1`。输出必须明确候选路径、未发生的 lifecycle/索引变化和后续入口。任何建议都不得要求重跑同一 `new`；需要新快照时使用候选查询或显式 preflight。

#### Candidate 扫描、查询与检查

Candidate scaffold 保持 `status: candidate`、`alignment: null`、`createdAt: null`，并具有完整规范摘要、tags、relations 和依次排列的 `目的`、`背景`、`决策` 三节；章节内容可以暂时为空。摘要与正文一致性的语义要求在正文形成后由 agent 审核，scaffold 阶段不把空正文伪装为摘要依据。

`candidates` 与 `show-candidate` 返回 `scaffoldValid`、`bodyReady` 和定位诊断。严格 `check` 接受合法 scaffold 作为索引外非正式成员，并分别计数 scaffold 与 body-ready candidates；非法 frontmatter、路径、章节形状、关系语法、身份冲突和集合错误仍阻断。候选始终不进入 established index 或 established relation graph。

现有 `discard` 可以显式删除 scaffold 或 body-ready candidate，并继续遵守引用、Git 历史确认、集合锁和恢复契约。普通编辑仍直接修改 candidate Markdown，但不能绕过最终扫描与建立门禁。

#### 可重复只读 preflight

`activate` 与 `evolve` 增加 `--preflight`。除禁止写入外，它们接受与真实命令相同的 successor、alignment、关系覆盖、clear、discard 和 Git 历史确认参数，并调用同一 lifecycle/relation preparation service。成功退出 `0`；attention、输入或领域阻断按现有类别退出 `1/2`，始终零写入且不取得集合 mutation 授权。

Preflight 可以读取当时的来源、索引与 Git 基线并返回 projected final graph/index，但不获取集合 mutation lock、不发布 Markdown 或索引、不写任何工作区内容，也不保存 receipt。即使 preflight 成功，非 preflight 命令仍重新获取锁、重扫来源、重读 Git、重新检查漂移，并要求调用方再次显式提供所有确认参数。

`new` 的单候选辅助预检复用相同准备组件，但不填造空正文来通过 `bodyReady`，也不要求单候选证明多后继拆分/重划闭包；无法证明时报告 `selection-incomplete`，由后续完整 `evolve --preflight` 选择验证。

### Resulting Impacts

#### 长期判断与文档

实现并验证后，以 successor Decision 修订“candidate 必须完整”的现行判断：candidate lifecycle 可以承接结构合法 scaffold，但 reviewable 语义状态仍由正文与人工审核形成；正式集合边界不变。建立 successor 并同步索引后，归档被替代判断。Skill、固定规则、恢复说明与人类介绍同步采用三维事实，不使用 readiness 暗示授权。

#### 领域实现与诊断

扫描记录、查询结果、检查摘要和公开声明需要承接 scaffold/body readiness。Lifecycle preparation 必须成为 preflight 与正式命令的共享只读核心，mutation transaction 只包裹正式发布。`new` 创建失败使用已有 Decision mutation diagnostics；创建后的辅助诊断不含 `scope/outcome`，因为预期 scaffold 已成功提交且命令本身成功。

集合锁覆盖创建时的身份复核与目标发布，确保 sync-index、lifecycle、discard 与并发 new 不会观察半写或共同占用身份。辅助 preflight 不把锁当作 receipt；最终命令仍完成自己的锁内漂移检查。

#### 分发与验证

命令、结果类型与扫描字段变化从 `tools/decision-records/` 生成分发 CLI、声明、source map 与 Schema，并提升独立 skill 版本。每个新增或修改的最小原生测试入口维护一个 Test Evidence case，Decision 与 Test Evidence 索引分别由其 owner 同步。

## Risks / Trade-offs

| 风险或取舍 | 控制 |
| --- | --- |
| 不完整 candidate 削弱“candidate 即可审核”的旧心智 | 使用 `scaffoldValid` 与 `bodyReady`，并把语义审核留在 skill 流程 |
| `new` 成功但 preflight 有 attention 可能被忽略 | 分区输出到 stdout/stderr，提供显式可重复 preflight，最终命令仍 fail closed |
| 可选 alignment 使创建预检不总能生成完整索引投影 | 诚实报告 unresolved，只投影已知字段；最终命令强制 alignment |
| `--preflight` 与真实命令产生重复表面 | 使用同一参数和 preparation service，唯一差别是禁止 mutation，避免两套语义 |
| 原子不覆盖创建和集合锁增加实现复杂度 | 把完整临时内容、身份复核和发布限定为最小创建事务，并用并发测试证明 |
| 预检后状态漂移 | 不保存 receipt；真实命令重新读取、加锁和校验 |

## Open Questions

无。

## Plan Use Contract

- 实施者先从 proposal 恢复创建成功、body readiness、preflight 与建立授权的分离，再按 tasks 顺序修改 owner。
- 已归档的维护诊断 Change 是当前事实前置，不再等待；Readiness 负责映射实际类型与 renderer，而不是复制或重建分类。
- CLI 字段或内部 helper 可以按现有实现组织，但不得改变本 design 的退出、写入、确认和最终复核边界。
- 本 Plan 不授权建立 successor Decision、修改 skill 或执行发布；后续实施授权、checkbox 和验证证据分别判断。
