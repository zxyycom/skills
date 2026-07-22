# 现有上下文管理 skills 与统一上下文管理系统的差距调查

## 调查信息
- 核心问题: 现有上下文管理 skills 组合起来，距离一套统一的上下文管理系统还差什么，Docnav 已经实践了其中哪些能力？
- 状态: 暂停
- 最新报告时间: 2026-07-21T17:50:15+08:00

## 调查报告

### 现有组合的主要差距位于路由与协作层
- 形成时间: 2026-07-21T17:50:15+08:00

#### 形成时背景

本仓库已经用 [decision-records](../../../skills/decision-records/SKILL.md)、[OpenSpec](../../../skills/openspec-explore/SKILL.md)、[investigation-report](../../../skills/investigation-report/SKILL.md)和 [test-evidence-review](../../../skills/test-evidence-review/SKILL.md)分别承接长期判断、change 上下文、阶段性认识和稳定验证义务；规范、代码、配置和测试等项目事实继续由各自 owner 承接。[项目导航](../../navigation.md)负责按任务定位这些内容，[仓库模型](../../repository-model.md)则明确同仓维护不自动产生 skill 间的组合、交接或验证承诺。

用户观察到这些能力组合后已经接近一套项目上下文管理系统，希望判断现有 owner、项目导航和项目治理已经解决了什么，还缺少哪些能够让它们作为整体工作的能力，并提供 [Docnav 提交 `2df037f`](https://github.com/zxyycom/docnav/tree/2df037fa0a2553a9cabe6dc8d01187a424926393)作为实践样本。

本报告把“统一上下文管理系统”最低理解为：从一个任务进入，能够找到必要上下文、保留各自 owner、判断跨 owner 关系和有效性，并把新认识回写到正确位置且完成必要检查。它不预设集中存储，也不包含需要独立协调模型的实时在途工作。

#### 调查目的

本轮要直接回答现有上下文管理 skills 距离上述统一系统还有多远，并用 Docnav 判断哪些组合机制已经在真实项目中成立。调查区分已确认的能力缺口与尚未取得的验证证据，但不在本轮决定是否建设新系统、采用何种架构或创建新的 skill。

#### 调查范围与依据

本轮检查了本仓库相关 skills 的 owner 契约、项目导航和仓库模型，并按内容 owner、任务路由、关系与有效性、结果交接和组合校验五项能力整理结论。本仓库材料以 `main@dcf9f5f1a43a1ca1b6635be8ded2d055b8c38938` 及当时工作区为主要基线，项目导航包含未提交的调查路由补充；全部材料没有固定到同一 commit 或 diff，因此本报告不能恢复唯一的仓库材料快照。

外部实践只检查了 2026-07-21 观测的 Docnav 提交 `2df037f`，重点读取其文档导航、长期决策与 OpenSpec governance specification。没有比较其他项目，也没有测量上下文恢复时间、漏读、冲突或维护成本；实时并行执行因需要独立的运行时协调模型，不纳入本轮差距判断。

#### 调查结果与边界

现有组合已经越过“是否有内容载体”的阶段：主要持久上下文已有明确 owner，本仓库和 Docnav 都展示了项目级导航，Docnav 还实践了稳定 owner、OpenSpec change、长期决策之间的分工和归档交接。尚未共同解决的是从任务识别最小必要上下文、判断跨 owner 的权威性与时效、把结果交给正确 owner，以及检查整个交接没有遗漏或冲突。

因此主要差距位于路由与协作层，而不是继续增加记录型 skills；现有组合还不能作为一个整体进入和验收，但当前证据也不能证明这些能力必须由新系统提供。单个实践项目和缺少量化对照使本轮无法给出完成百分比、通用实现边界或建设决定。

#### 差距判断

| 能力 | 已有基础 | 尚未解决或证明 |
| --- | --- | --- |
| 内容 owner | 决策、change、调查、测试证据和项目事实已有明确分工 | 通过更多真实任务确认是否仍有重要上下文类型未被承接 |
| 任务路由 | 本仓库与 Docnav 都用项目导航定位 owner | 从任务识别最小必要上下文，并适配不同项目结构和可选 skill 组合 |
| 关系与有效性 | 各载体有自己的状态和边界；Docnav 区分稳定规范、change 与长期决策 | 表达跨 owner 的来源和影响，并在冲突或失效时判断当前依据 |
| 结果交接 | 各 skill 已声明部分下游边界；Docnav 已规定归档同步条件 | 统一判断何时链接、同步或产生候选，并确认结果进入正确 owner |
| 组合校验 | 各 owner 可以拥有局部检查，Docnav 已有部分归档验收 | 发现漏读、失效引用、遗漏交接和 owner 冲突，形成端到端验收 |

#### Docnav 证据

1. [项目文档导航](https://github.com/zxyycom/docnav/blob/2df037fa0a2553a9cabe6dc8d01187a424926393/docs/navigation.md)把稳定规范、OpenSpec、长期决策和实现证据路由到不同 owner。
2. [长期决策与 OpenSpec 分离](https://github.com/zxyycom/docnav/blob/2df037fa0a2553a9cabe6dc8d01187a424926393/docs/decisions/decision-management/separate-decision-spec-ownership.md)说明 change 内判断与跨 change 长期理由可以相关而不争夺最终 owner。
3. [OpenSpec 归档治理](https://github.com/zxyycom/docnav/blob/2df037fa0a2553a9cabe6dc8d01187a424926393/openspec/specs/openspec-governance/spec.md)规定归档前按条件把跨 change 内容同步到稳定规范和长期决策。

这些证据证明多个 owner 可以通过项目治理协作，但不能证明相同规则适用于任意项目，也不能证明统一任务入口、跨 owner 有效性判断和组合校验已经成立。

#### 后续调查

后续若重新开启，应在至少两个结构不同的项目中选择少量真实任务，记录实际需要的 owner、漏读与噪音、冲突处理、结果回写、组合检查和维护成本，再比较项目导航与本地治理、公共只读路由或组合校验分别改善了什么。只有真实任务反复暴露同一连接缺口，且项目规则难以低成本解决时，才进一步讨论扩展现有 skill、创建新 skill 或建设独立系统。
