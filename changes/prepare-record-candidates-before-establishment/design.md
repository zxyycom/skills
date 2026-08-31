# Design

本 design 供后续实施与审查 agent 恢复命令责任、状态边界和验证顺序；它以共同作者工作流协调两套领域命令，但不把决策候选生命周期复制给调查报告。

## Context

- 当前决策记录已经有 `candidate` 状态，但稳定规则要求 candidate 正文完整、可审核并位于决策根目录；`activate/evolve` 才写入 alignment、createdAt、正式索引和最终关系事务。
- 当前调查报告没有生命周期字段或归档目录；根目录直属报告全部属于正式集合，`sync-index` 从完整正式 Markdown 集合重建唯一索引，`stage-index` 只负责把已同步索引中的选中条目组合到 Git pending。
- Decision ID 与 Investigation ID 都是稳定 Markdown basename。两套领域都有直接前序关系、完整图约束、派生索引、集合 mutation lock 和可恢复写入，但关系类型、生命周期、资源与历史门禁不同。
- 决策的未记录前序是阻断式 attention；调查关系中的未记录前序只是 warning。创建时的事务预检应复用各领域最终事务的判断，不把两者统一成同一严重性。
- `make-maintenance-diagnostics-actionable` Change 拥有共享 Git、权限、锁和事务结果表达。本 Change 只消费该契约，不建立第二套错误分类。
- 本 Plan 拥有本次预期调整、实施顺序和验收范围；当前领域事实仍由两套 `SKILL.md`、固定契约、Decision Records 与维护源码拥有。实现发现事实不同时先更新本 Plan，不能把计划文字当作已经生效的行为。

## Goals / Non-Goals

目标：

- 让维护者用 CLI 参数一次写出规范元数据和可继续编辑的空正文骨架。
- 在创建时尽早预检最终关系、索引和 Git 历史结果，同时保持最终动作独立复核。
- 为调查新报告提供按 ID、可批量闭合、可恢复的正常建立入口。
- 让未选择候选和无关工作不被创建或发布事务吸收。

非目标：

- 不自动生成调查结论、决策正文、关系语义、证据或 alignment 判断。
- 不保存 preflight receipt、revision token、确认凭据或隐式重试状态。
- 不让 `new` 激活决策、建立正式报告、写 Git pending 或提交 Git。
- 不把调查候选建模为 active/archived 生命周期，不改变 `stage-index` 的 index-only pending 责任。
- 不用 `publish` 接纳任意未选择的正式 Markdown 漂移；全量手工恢复继续属于 `sync-index`。

## Decisions

### Intended Change

#### 共同命令边界

共同工作流固定为：

```text
显式 metadata 参数
  -> exclusive create candidate scaffold
  -> 报告预期的正文 readiness
  -> 只读预检当时可由 metadata、正式基线和 Git 确定的事务维度
  -> 人工或 agent 编辑正文
  -> 显式 activate/evolve 或 publish
  -> 重新读取并执行完整最终校验
```

两套 `new` 都接收一个稳定 ID，以及对应 frontmatter 的必需投影字段、可重复 tags 和可重复直接关系。Decision Records 另外接收只服务本次预检的 alignment；该值不得写入 candidate metadata，也不代表最终建立确认。Investigation Report 的 `formedAt` 必须由调用者显式提供，不能用 scaffold 创建时间冒充认识形成时间。精确选项名和重复参数形式由各自 `help new` 固定，但实现不能从正文、历史或自然语言猜测关系、tags、formedAt 或 alignment。

`new` 的处理阶段与写入结果固定如下：

| 阶段 | 处理内容 | 失败或未完成时的结果 |
| --- | --- | --- |
| 输入与目标安全 | 参数语法、ID、字段、tag/关系结构、候选位置、身份冲突 | 不创建目标文件，参数错误退出 `2`，其他操作失败退出 `1` |
| candidate create | 规范序列化与 exclusive create | 创建失败退出 `1`，不覆盖已有成员 |
| body readiness | 固定章节是否已经满足最终正文规则 | 新建空 scaffold 按设计显示 `incomplete`；这不是 `new` 自身失败 |
| transaction preflight | 当时可确定的关系、正式基线、图、索引影响与 Git 历史 | scaffold 保持存在；阻断式 attention、error 或必要检查 unavailable 使 `new` 退出 `1`，调查领域既有非阻断 warning 仍退出 `0` |

命令输出因此必须分别给出 `creation`、`readiness` 和 `preflight`，不能用一个“成功/失败”概括三者。预检阻断或 attention 不回滚已经安全创建的候选，但输出必须明确候选路径、没有发生的正式集合/索引变更和后续显式命令。

预检只构造由已提供 metadata、当前正式基线和 Git 基线支持的 projected transaction；它不得填造正文、证据或结论来伪装 activation-ready/publish-ready，也不调用写入发布器。无法在单候选创建时证明的多后继闭包明确报告 `selection-incomplete`，由后续完整候选批次在最终命令中验证。实际建立重新读取当前来源、索引、Git 基线和锁状态，不接收或查找任何来自创建预检的 receipt。

#### 决策 candidate scaffold

决策 `new` 在根目录写入 `status: candidate`、`alignment: null`、`createdAt: null` 的规范 frontmatter，以及顺序固定但允许暂时为空的 `目的`、`背景`、`决策` 三节。候选扫描把以下状态分开：

- **candidate scaffold**：身份、位置、frontmatter、tags、关系语法和固定章节结构合法，但正文语义完整性尚未满足。
- **activation-ready candidate**：在 scaffold 条件上进一步满足全部非空正文、`采用` 字段、关系目标与候选审核规则。

两者都不进入正式索引和正式关系图。`candidates` 与 `show-candidate` 展示 readiness 和可定位诊断；严格 `check` 接受合法 scaffold 作为非正式成员，但仍阻断非法 frontmatter、路径、章节形状或不可解析关系。`activate/evolve` 只接受 activation-ready candidate，`discard` 可以显式删除两者。

`new` 的预检使用命令行投影构造 projected transaction，只运行不依赖正文完成度的最终关系、图、索引和 Git 历史判断。它不得把 purpose/background/decision 摘要复制成正文来通过完整性校验。预检 alignment 只服务于本次模拟，不写入 candidate metadata。实际建立仍由调用者在 `activate/evolve` 中重新给出 alignment、最终关系覆盖和任何历史确认参数。

#### 调查候选与选择性 publish

调查候选位于固定的集合外目录 `_candidates/<investigation-id>`，使用与正式报告相同的 frontmatter 字段顺序和四个固定正文节，但允许正文暂时不完整。该目录只保存 authoring candidate，不属于正式报告成员、正式关系图、正式索引 source revision 或报告生命周期。

调查命令责任保持下列单向关系：

```text
_candidates/<id> --publish selected IDs--> <id> + investigation-index.json
正式根目录报告 --sync-index full rebuild--> investigation-index.json
investigation-index.json --stage-index selected entries--> Git pending
```

`candidates` 与 `show-candidate <id>` 负责候选发现、原文、正文 readiness 和当前结构诊断；它们不读取或保存创建时的事务预检结果，也不把普通查询冒充新的 publish 预检。默认 `check` 只把候选目录安全、跨正式集合的 ID 冲突和文件身份问题作为阻断；候选正文或关系尚未 ready 作为候选诊断，不使无关正式集合维护失败。正式 `list`、`show`、`trace` 和 index source revision 完全忽略候选内容。

`publish <investigation-id...>` 至少选择一个规范且不重复的候选 ID。事务要求现有正式报告与持久索引是可用基线；首次正式集合为空时允许从空基线建立。它把选中候选的完整报告视图加入基线，验证 formedAt、tags、完整正文、直接关系、归并/拆分闭包、资源引用和最终全图，再构造包含全部正式报告的规范索引。关系目标必须存在于正式基线或同一选中批次，不能通过未选择候选补齐。

发布在集合 mutation lock 内重新读取候选、正式基线、索引和必要资源 revision。全部预检通过后，以可恢复事务把选中候选移动为根目录正式报告并发布新索引；任何目标冲突、漂移或发布前失败恢复原组合。未选择候选及其文件内容不参与目标索引，也不被移动、修改或删除。

`sync-index` 继续从当前根目录正式报告完整重建索引，服务索引缺失/损坏、契约升级、批量手工修正和显式接纳既有正式来源变化。它忽略候选内容，只阻断会破坏集合身份或文件安全的候选目录问题。普通新报告建立使用 `publish`，不再要求先把候选手工放入正式根目录再全量同步。

### Resulting Impacts

#### 契约与长期判断

决策侧需要以 successor Decision 修订“candidate 必须完整”的现行判断：candidate 生命周期可以承接结构合法的 scaffold，但只有 activation-ready 才能审核建立；正式集合边界保持不变。调查侧需要澄清 `_candidates` 是 authoring workspace 而不是报告 lifecycle，并为报告级索引增加选择性建立事务的长期方向。只有相应行为和验证落地后才建立这些后继决策并同步决策索引。

#### 查询、校验与恢复

两套候选查询需要返回 readiness，而不能把 scaffold 混称为完整候选。检查摘要分别统计 scaffold、ready candidate 和正式成员。决策根目录中的非法结构或关系继续阻断决策检查；调查 authoring candidate 的内容 readiness 不阻断无关正式集合操作，只有候选目录安全、身份冲突或显式 publish 目标非法才阻断对应操作。恢复说明必须区分候选创建成功但预检失败、发布前零写入失败、完整回滚和恢复不完整。

调查 `publish` 不能沿用 `stage-index`：前者拥有工作树正式报告和索引的领域事务，后者只拥有 Git pending 中选中索引条目的组合。`publish` 也不能把旧索引当作可随意混合的缓存；基线不可靠时要求 `sync-index`，防止未选择正式来源变化被隐式接纳。

#### 分发与验证

命令、公开类型和结果变化需要从 `tools/` owner 生成两套分发 CLI、声明和 Schema，并提升两个 skill 的独立版本。新增或修改的每个原生测试入口都需要对应 Test Evidence case；行为、决策和测试账本的派生索引分别通过其 owner 同步。

## Risks / Trade-offs

| 风险或取舍 | 控制 |
| --- | --- |
| 允许不完整决策 candidate 会削弱“candidate 即可审核”的旧心智 | 明确 scaffold 与 activation-ready；正式索引、关系图和建立入口只接受后者 |
| 创建预检不能证明稍后编辑后的实际正文 | 不构造虚假完整正文；独立显示 readiness，预检只覆盖 metadata 可确定的关系、图、索引与当时 Git 基线 |
| 调查候选目录看似生命周期 | 契约固定其为正式集合外 authoring workspace，不增加 status、archive 或查询生命周期 |
| 批量 publish 事务复杂度高于全量 sync | 只允许候选新增、要求可靠正式基线，并复用完整集合验证和既有可恢复发布边界 |
| 事务预检失败后候选仍存在可能被误解为整体失败 | CLI 分开展示 creation、readiness 和 preflight，并按共享诊断契约给出准确 mutation scope/outcome |
| 两个 Change 的实施顺序发生交叉 | 先落地共享诊断契约；候选 Change 的 readiness 明确禁止复制临时分类器 |

## Open Questions

无。

## Plan Use Contract

- 目标消费者是实施与审查本 Change 的 agent；它应先从 proposal 恢复 Outcome 和成功标准，再按本 design 的状态流与 `tasks.md` 顺序执行。
- `make-maintenance-diagnostics-actionable` 是共享错误表达前置；其结果未可复用时，本 Plan 保持可评审但 implementation 停在 readiness。
- 本 Plan 不授权建立 Decision、修改 skill 或执行发布；实际实施授权、任务 checkbox 和验证证据分别判断。
