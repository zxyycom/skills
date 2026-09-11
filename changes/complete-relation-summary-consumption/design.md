# Design

本 Draft 以边摘要覆盖率和消费矩阵为基础，重新决定 relation summary 在每个 agent-facing 入口中的责任。

## Context

- `260905-add-optional-relation-summaries` 首次允许 Decision 与 Investigation 的直接关系携带最多 40 个 Unicode 码点的可选单行摘要，并要求索引、领域 API、图和 trace 透传已有摘要。
- 当前活动决策 `260909-write-explanatory-relation-summaries` 进一步要求新建或调整真实关系时主动填写有正文依据的摘要，但继续允许字段缺省，并明确不因这一写作方向批量回填既有边。
- 2026-09-10 在 Decision 与 Investigation 严格全量检查通过、派生索引确认当前后统计：Decision 共有 287 条正式边，6 条有摘要、281 条无摘要；其中 active 来源边 107 条，4 条有摘要、103 条无摘要，archived 来源边 180 条，2 条有摘要、178 条无摘要。Investigation 共有 21 条正式边，0 条有摘要、21 条无摘要。
- 因而当前字段覆盖率约为 Decision 2.1%、Investigation 0%。这说明 trace 即使正确展示所有已存在 summary，大多数真实链路仍只能提供关系类型和目标。
- 已确认的消费路径包括：Markdown 与 parser/writer 保存字段；索引与 Schema 投影字段；rename 和关系事务保留或替换字段；metadata search 将非空摘要作为来源记录的文本段并在命中时展示边；trace 透传并条件展示摘要；show/show-candidate 通过完整 Markdown 间接展示。
- 当前 `list` 与 `list --detail` 不展示直接关系或摘要，关系筛选只返回匹配记录；关系维护命令的成功输出主要报告受影响 source，没有回显最终边说明。其他 preflight、生命周期结果、诊断和程序化入口仍需形成完整消费矩阵后逐项决定。
- [relation-summary-audit.md](relation-summary-audit.md) 保存本 Change 的当前覆盖率快照、统计方法与初始消费审计。缺失字段与消费遗漏是两类不同问题，不能用同一计数替代。

## Goals / Non-Goals

目标：

- 完整枚举 relation summary 的生产、维护、投影、查询、展示、诊断和 agent 使用入口。
- 对每个入口明确 summary 是必需信息、条件信息、搜索证据、只读上下文还是有意省略。
- 让调用方区分边没有摘要、当前操作没有读取摘要和输出格式省略摘要。
- 决定历史无摘要边的处理范围，并以可复核统计而非直觉估算迁移成本。
- 让 Decision 与 Investigation 在共同语义上保持一致，同时保留各自不同的生命周期与查询职责。

非目标：

- 不在本 Change 中重新设计 trace 的整体图结构、深度、方向和节点投影；这些由 `redesign-trace-for-agent-consumption` 负责。
- 不把 summary 变成边身份、排序、去重、拓扑或关系合法性的组成部分。
- 不自动根据关系类型或两端标题生成看似权威的摘要。
- 不在 Draft 阶段批量改写 302 条无摘要正式边。

## Decisions

### Intended Change

以下是 Draft 阶段的工作方向，而非已经确定的最终行为：

- 建立完整 producer/consumer matrix，至少覆盖 new、candidate 编辑与 readiness、activate/evolve/publish、set-relations、rename、索引同步与 Schema、list、relation filter、search、show、trace、preflight、mutation result、诊断、领域 API、生成类型与分发 CLI。
- 为每个入口分别决定：是否取得 summary、是否返回 summary、是否在终端展示、缺失时如何表达、是否需要测试以及是否影响兼容契约。
- 将“新建或调整关系应主动填写”的写作要求与字段是否成为机械必填项分开决定；若改变兼容策略，需要形成后继 Decision，而不能只改 validator。
- 对历史边在“不回填”“只回填仍 active 或高频链路”“分批回填全部可可靠恢复的边”之间作出明确选择，并要求每条写入摘要仍有两端正文依据。
- 为覆盖率或缺失状态选择合适的可观察入口；候选包括只读审计命令、check warning、查询结果中的显式 availability，不能在没有决定其长期 owner 前新增平行状态文件。
- 与 trace Change 约定交接：本 Change 决定边语义何时存在、如何缺失以及一般消费规则；trace Change 决定这些字段如何进入一次性图投影。

### Resulting Impacts

- 若 summary 从写作推荐升级为结构必填，Decision 与 Investigation 的固定契约、Schema、parser、candidate readiness、关系事务、历史数据兼容和迁移门禁都会受到影响。
- 若仅改消费行为，CLI output、领域返回类型、查询匹配结果、文档和回归测试仍需同步，并可能改变已有脚本依赖的文本输出。
- 历史回填会修改大量正式 Markdown 与派生索引；必须逐边审查语义、保护并行改动，并判断是否需要拆批或只处理 active 链路。
- list、筛选与 mutation 输出若展示边详情，需控制重复和输出量，避免把全量关系集合无条件塞入发现型查询。
- metadata search 当前只把非空 summary 作为文本证据；若改变 type、target 或缺失边的搜索行为，需要修订既有 active Decision，而不是作为展示优化附带改变。
- 工具源码改动需要同步生成 MJS、类型声明、测试与相应测试证据 Case；skill 行为和固定契约需同步说明 agent 能依赖哪些字段。

## Risks / Trade-offs

- 强制所有边有摘要能提高一致性，但会把 302 条历史缺口变成迁移门禁，并可能诱导缺乏正文依据的低质量回填。
- 继续完全可选兼容能保护历史，却会让调用方长期面对“绝大多数链路没有说明”的事实。
- 在所有输出中展示摘要会增加噪声和 token 成本；完全依赖调用方另查又会重现多次调用问题。
- check warning 能暴露缺口，但若每条旧边都警告会淹没其他诊断；聚合统计或 scoped policy 可能更合适。
- 用节点标题或正文推断缺失摘要能改善即时可读性，但若不显式区分记录事实与运行时推断，会破坏调查和决策的可回放性。
- 两个领域同时改进可以统一体验，但历史规模、节点 metadata 与生命周期不同，迁移策略未必应完全一致。

## Open Questions

1. 完整消费矩阵还包括哪些隐含入口：候选 readiness、publish/activate/evolve preflight、成功结果、失败诊断、直接 SDK、list 关系筛选或其他路径？
2. “新建或调整关系时填写摘要”是否继续只由 agent 写作流程保证，还是应成为 candidate/transaction 的机械必填条件？
3. 既有 302 条无摘要边应保持兼容、只回填 active/高价值链路，还是在有充分正文依据时分批全部回填？
4. 缺失摘要在 API 和终端中应显式表现为 `unavailable`、`null`、省略字段加能力标记，还是由外层 coverage 汇总表达？
5. `list --related-to`、`list --detail` 等发现型查询是否应返回命中的具体边与摘要，而不是只返回记录？默认输出与 detail 输出如何控制体积？
6. 关系建立、替换与 preflight 是否应回显最终规范边集合及摘要，方便 agent 在写入前后核对实际语义？
7. `show` 已通过 Markdown 展示 summary，是否还需要独立结构化 metadata，避免 agent 再解析 frontmatter？
8. 40 个 Unicode 码点是否足以承担 agent 所需的边说明；若不足，应扩展字段还是组合节点摘要，而不是让 summary 取代正文？
9. metadata search 对 summary 的现有证据规则是否保持不变；缺失摘要是否需要可筛选但不参与全文命中？
10. 是否需要只读 coverage 查询或聚合 check 结果，以及该能力属于两个领域各自 CLI 还是共享索引工具？
11. Decision 与 Investigation 哪些入口必须保持同构，哪些差异是由 status/alignment、formedAt、资源或 publish 生命周期造成的真实差异？
12. trace 消费时，缺失 summary 的表示由本 Change 统一定义到何种程度，哪些图级字段留给 trace Change？
