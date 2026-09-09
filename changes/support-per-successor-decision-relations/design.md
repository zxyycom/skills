# Design

本 design 将完整关系事务拆成“完整 successor 参与者集合”和“每个 successor 的完整最终关系输入”两个正交维度，并以显式分组扩展 `evolve`，不改变闭合策略和事务提交边界。

## Context

- `evolve` 当前通过重复 `--successor <alignment=selector>` 选择完整 successor 集合；拆分要求同一前序至少两个完整直接后继，重划要求至少两个前序、两个后继和一个连通稀疏二部图。
- 当前 `DecisionLifecycleRequest` 只携带一个事务级 `DecisionRelationOverride`。关系事务遍历 successor 时把该 override 传给每个记录，因此统一 relation set 和 summaries 会复制到全部 successor。
- `--relation-summary <target=summary>` 在同一完整 relation set 内按 target 唯一绑定。拆分的多个 successor 指向同一 predecessor 时，当前参数层既不能重复 target，也没有 successor 维度可供区分。
- candidate Markdown 是每个新 successor 的独立完整来源；首次建立时省略 CLI override 已能表达不同关系和摘要。缺口集中在已建立多后继事件的关系维护，以及需要由 CLI 明确提供逐 successor 覆盖的场景。
- `evolve` 已经统一承担最终图预演、活动前序归档、candidate 建立、已建立关系修订、历史确认、锁、恢复、索引重建和读回。逐 successor 输入必须进入这条事务，不建立另一个写入口。
- Investigation Report 的 `set-relations --source` 已证明“一个事务包含多个完整 source group”的 CLI 心智模型可用；Decision Records 仍需在自身 owner 内实现与生命周期、alignment 和闭合策略一致的输入，而不依赖另一个领域工具。
- 当前人类说明中的“升级到要求非空 alignment 的 definition 前”是一次性升级步骤，不是当前常规维护路径。固定规则和恢复手册已经拥有非法 alignment 与 definition/index 恢复，因此人类入口应回到当前操作主线。

## Goals / Non-Goals

目标：

- 让完整 successor 事件中的每个 successor 拥有独立、完整、可审核的最终关系输入。
- 保持 v53 的统一 override 作为无分组时的兼容快捷方式，并保持 candidate 来源优先路径。
- 让分组关系和摘要在选择器收敛后绑定明确 source/target，且所有错误在事务写入前暴露。
- 让最终图校验、前序生命周期和提交恢复继续只执行一次，避免逐组中间状态。
- 让行为文档先呈现目标模型和推荐路径，再呈现无效组合与恢复条件，使 AI 能从局部文本正确构造命令。

非目标：

- 不为 summary 建立 patch 语义，也不让省略的边从旧关系中隐式继承 summary。
- 不把逐 successor 分组变成多个事务、多个 `evolve` 调用或关系类型专用命令。
- 不改变现有图策略、relation schema、summary schema、索引 schema version 或记录生命周期。
- 不根据文档长度或否定词数量进行全局重写；精确禁止项在能检验目标行为时继续保留。

## Decisions

### Intended Change

#### Transaction model

关系事务使用以下模型：

```text
一个 evolve 事务
├── selected successors：必须覆盖本次闭合事件的完整参与者集合
└── final relations by successor
    ├── successor A：来源原值或一个完整 replacement
    └── successor B：来源原值或另一个完整 replacement
```

完整参与者集合只决定哪些 successor 必须共同接受最终图验证和提交；它不要求各 successor 的 relation type、target 或 summary 相同。每个 successor 的最终关系仍只有两种来源：保留当前权威 Markdown 的完整集合，或使用本次输入对该 successor 做完整替换。事务不合并新旧数组，也不按边 patch。

#### CLI grouping

`evolve` 新增重复选项 `--relations-for <successor-selector>`。它开始一个关系输入组，直到下一个 `--relations-for`；组内使用现有 `--relation`、`--relation-summary` 或 `--clear-relations`：

```text
decision-records evolve \
  --successor aligned=successor-a \
  --successor unaligned=successor-b \
  --relations-for successor-a \
  --relation 拆分=coarse-predecessor \
  --relation-summary coarse-predecessor=承接当前已落地边界 \
  --relations-for successor-b \
  --relation 拆分=coarse-predecessor \
  --relation-summary coarse-predecessor=承接仍面向未来的边界
```

分组规则：

1. 没有 `--relations-for` 时沿用现有统一模式：一个完整 override 应用于全部 selected successors；完全省略 relation 选项时，每个 successor 保留自身来源集合。
2. 出现 `--relations-for` 时进入分组模式。所有 relation、relation-summary 和 clear 事件必须归属某个当前组，不能再提供事务级统一 override。
3. 分组 source 与 `--successor`、relation target、summary target 分别先按标准 selector 规则收敛为 Decision ID。解析后的 group source 必须是 selected successor，并且在一次命令中只出现一次。
4. 每组必须选择一种完整替换意图：至少一个 `--relation`，或一个 `--clear-relations`。组内 summary 可以位于 relation 前后，但最终必须按解析后的唯一 target 绑定该组完整关系集合。
5. 未建立分组的 selected successor 保留自身来源关系。这使调用方只声明实际变化的完整 successor 集合，同时仍通过 `--successor` 明确选择整个闭合事件。
6. 同一 predecessor target 可以在不同组各出现一次并保存不同 summary；重复限制只作用于同一 source group。

分组模式与统一模式互斥，避免“统一默认值加局部 patch”的优先级。该语法复用现有 relation value，不引入 JSON 参数、临时 manifest 或摘要专用更新入口。

#### Parsed domain input

`DecisionSuccessor` 增加可选的 `relationOverride`，表示该 successor 的来源保留或完整 replacement。CLI 分组先转换为按 successor 归属的已解析 override；事务级统一模式继续保留现有 top-level override，并在准备阶段作为没有局部 override 时的默认值。

准备每个 successor 时选择：

```text
effective override = successor.relationOverride ?? transaction.relationOverride
```

CLI 不允许同时构造局部和非 source 的事务级 override；上式只保留内部兼容和直接领域调用的明确默认关系。选择器解析、摘要绑定和重复检查完成后，领域事务只接收规范 Decision ID 与已验证的完整 relation objects。

#### Transaction and diagnostics

`prepareDecisionRelationTransaction` 先为全部 selected successors 计算最终关系，再沿用现有顺序执行：直接前序恢复、策略选择、形状检查、闭包检查、最终图预演、历史门禁、变更计划和可恢复写入。不会按 group 单独归档前序、写 Markdown 或同步索引。

参数与领域诊断至少区分：关系事件出现在首个 group 前、空 group、group 模式与统一模式混用、group source 重复、source 未被选择、组内 relation target 重复、summary target 重复或未命中、summary 与 clear 冲突，以及最终拆分/重划闭包错误。CLI 参数形状错误退出 `2`；需要读取集合或最终图后才能判断的领域失败退出 `1`，两者均保持零写入。

#### Documentation and durable decision

行为文档按以下阅读顺序收敛关系维护内容：

1. 先说明关系边方向、完整 successor 参与者集合和逐 successor 最终关系集合。
2. 用一张局部对照表区分 candidate 自带关系、统一 override、逐 successor 分组和显式清空。
3. 再说明拆分、重划闭包与无效输入，保留用于安全和精确校验的负向规则，不把禁止项作为主承诺。
4. CLI 精确 option 语法只在 help 完整维护；`SKILL.md` 和人类说明保存动作选择、示例入口及固定规则链接，不复制解析细节。
5. `docs/skills/decision-records.md` 用当前“严格检查 → 根据诊断进入索引恢复或非法来源恢复”的路径替换一次性 alignment definition 升级段落。历史兼容继续由规则和恢复手册承接。

实施时新增一条自包含 Decision Records 后继决策，以“修订”关系指向 `replace-decision-relations-as-complete-sets`，说明“事务成员完整”和“逐 successor 完整载荷”是正交约束、统一 override 是兼容快捷方式、分组仍是完整替换。它通过 Decision Records CLI 关系事务建立并同步索引，不直接改写旧决策，也不把本次 20 条记录或 v53 排查过程写入长期正文。

### Resulting Impacts

#### Compatibility and versioning

- 现有无 `--relations-for` 命令继续使用统一 override，参数顺序和最终关系不变。
- 现有省略 override 的 candidate/established source 模式不变；新分组是增量 CLI 能力，不要求迁移旧命令或旧 Markdown。
- `DecisionSuccessor.relationOverride` 为可选字段，既有程序化对象仍合法。生成声明从运行时源码机械同步，不建立第二声明 owner。
- Decision Records skill metadata version 从实施基线上的当前值递增；实现时以集成分支实际版本为准，不在 Change 中硬编码最终数字。

#### Parser and ownership

- Commander 当前按 option 聚合值，不能单靠最终 options object 恢复跨 option 分组。CLI 边界需要像同仓已有 source-group parser 一样保留相关 argv 事件顺序，再统一转换为领域对象。
- 分组解析属于 Decision Records CLI 输入 owner；relation summary 规范化与绑定继续由现有 summary owner 承担，关系形状和闭包继续由 relation transaction owner 承担。
- 不把两个领域的 group parser 因表面相似立即抽到 `tools/shared/`。只有实施中确认存在同一稳定协议和至少两个真实 consumer，且抽取不会混合领域诊断时，才按共享 owner 门槛另行评估。

#### AI-ready documentation review

AI 消费契约是：agent 从 `SKILL.md` 进入，按链接读取固定规则，能够在不依赖本次对话的情况下为三类任务选择输入——首次建立 candidate、统一维护相同关系、维护已建立多后继的不同关系或摘要。

审阅以误用风险为依据，而不是按词频或行数整改：

| 检查维度 | 本 Change 的处理标准 |
| --- | --- |
| 重心 | “完整事件、逐 successor 最终集合、单次提交”先于参数禁用列表出现。 |
| 负向描述 | 精确失败条件保留，但放在推荐输入模型之后，并与可观察诊断或零写入结果相连。 |
| 迁移残留 | 删除或改写只服务既往 definition 升级的一次性入口；legacy ID、非法 alignment 和索引恢复等持续兼容责任保留在对应 owner。 |
| 内容长度 | 只合并重复关系说明和过长局部段落；不以 119/228 行等指标单独触发拆文件。 |
| Markdown 样式 | 保持既有标题层级、表格与 fenced examples；每张表的行和每个小节脱离视觉位置后仍能识别对象与范围。 |

#### Tests and evidence

测试需要分别证明解析边界、领域最终关系、事务零写入与分发行为。每个新增或修改的最小 `test(...)` 节点按 Test Evidence 契约维护唯一 Case；聚合测试文件和 package script 不作为 Case 替代品。

## Risks / Trade-offs

| 风险或取舍 | 控制 |
| --- | --- |
| 分组依赖 argv 顺序，使用者可能把 relation 写在 group 前 | Help 和参数诊断明确 `--relations-for` 是组起点；成功与失败示例覆盖顺序边界。 |
| 同时保留统一与分组模式增加 CLI 表面 | 两种模式严格互斥；统一模式保障兼容和同构拆分便利，分组模式只解决不同载荷。 |
| 省略某个 selected successor 的分组可能被误认为遗漏 | 文档明确省略表示保留其完整来源集合；preflight 输出和测试验证最终完整集合。 |
| 可选 per-successor override 可能产生隐式优先级 | CLI 禁止局部与非 source 全局 override 混用；内部只用统一 source/default 组合，不向用户暴露叠加语义。 |
| 文档审阅扩大成无关风格整理 | 只修改直接消费路径中会改变本功能理解、动作选择或恢复的内容；其他信号记录为不在本 Change 范围。 |
| 新长期决策与当前完整集合决策发生双 owner | 新后继通过正式“修订”关系归档旧 owner，并自包含保留仍有效的完整替换与闭包边界。 |

## Open Questions

无。公开分组选项使用 `--relations-for <successor-selector>`；分组与统一 override 互斥；未分组 successor 保留来源关系；组内关系是完整替换而不是 patch；既有闭合与事务边界不变。
