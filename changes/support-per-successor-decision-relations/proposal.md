# Proposal

本 Change 为 Decision Records 的完整多后继事务增加逐 successor 的完整关系输入，并同步收敛直接使用文档，使建立和维护拆分、重划时都能从当前文本恢复正确操作。

## Why

当前 `evolve` 要求拆分和重划一次选择完整后继集合，但 CLI 只能把同一关系集合与摘要复制到全部后继。候选首次建立可以使用各自 Markdown 中的关系；已建立后继的关系必须通过 CLI 事务维护，因此不同后继的合法关系或摘要无法通过现有公开入口完整表达。

需要把“完整参与者集合”与“各参与者的完整关系输入”分开，同时保持统一事务的图校验、历史确认和恢复保障。直接使用文档同步围绕这两类集合组织推荐路径，使使用者能够选择正确输入。

## Outcome

- `evolve` 仍在一次事务中选择完整 successor 集合，但可以为其中任一 successor 提供独立的完整关系替换或清空输入。
- 不同 successor 可以对同一 predecessor 保存不同 summary；稀疏重划可以在一个事务中为各 successor 保存不同关系集合和逐边摘要。
- 未提供逐 successor 分组时，现有统一 `--relation`、`--relation-summary` 与 `--clear-relations` 行为保持兼容；candidate 自带关系且省略覆盖的推荐路径保持不变。
- 逐 successor 输入仍经过选择器解析、完整替换、关系摘要绑定、闭合策略、最终关系图、历史确认、锁、恢复、索引重建和读回验证，不形成 patch 或旁路写入。
- Decision Records 的行为入口、固定规则、人类说明、CLI help 和长期决策清楚区分“事务参与者必须完整”和“每个参与者载荷可以不同”，且不再用一次性迁移说明占据常规维护主线。

## Scope

### Intended Change

- 为 `evolve` 增加以 selected successor 为 source 的关系输入分组；每组完整声明该 successor 的最终 relations、可选 summaries 或显式清空。
- 将逐 successor override 表达到解析后的领域输入和关系事务准备阶段，同时保留无分组时的统一 override 兼容入口。
- 更新 Decision Records 行为 owner、CLI help、生成声明与分发制品，并建立一条修订现有“完整集合替换”判断的长期后继决策。
- 为参数解析、选择器收敛、多后继事务、分发 CLI 和失败恢复边界补充测试，并维护对应 Test Evidence Case 与派生索引。
- 按 AI-ready 文档消费契约审阅直接相关段落，处理关系维护主线的重心、负向描述顺序、一次性迁移残留、局部篇幅和 Markdown 层级；没有实际问题的章节保持不变。

### Resulting Impacts

- CLI 必须保留 relation 参数的出现顺序，才能把每个 `--relation`、`--relation-summary` 或清空动作绑定到明确 successor 分组；参数错误需在任何写入前给出可行动诊断。
- 关系事务先得到每个 successor 的最终完整关系集合；历史基线探测、形状与闭包检查、最终图验证和 relationReview 使用同一最终集合。
- 逐 successor 类型进入当前 CLI 的公开类型导出后，机械生成的声明闭包、bundle、source map 和 skill version 必须同步。
- 文档必须把候选首次建立、已建立关系维护、统一快捷覆盖和逐 successor 分组放入同一局部对照，同时让精确语法继续由 CLI help 承接。
- 新增或修改的每个最小原生测试入口都需要唯一 Test Evidence Case；Decision 与 Test Evidence 的派生索引都需要通过各自正式入口同步。

### Non-Goals

- 放松拆分、重划的完整 successor 集合、连通性、角色互斥、前序覆盖或语义承接要求。
- 增加单边 add/remove/patch、仅 summary patch、手工编辑已建立关系后的特殊同步许可，或拆分、重划专用旁路命令。
- 强制回填全部历史关系摘要；旧边继续允许省略 summary。
- 改变关系类型、边方向、边身份、摘要长度、生命周期、alignment、discard、rename、stage、查询或索引权威性。
- 因行数、否定词数量或统一风格而拆分整个规则文件、重写历史决策，或修改与本 Change 使用路径无关的文档。

## Success Criteria

- 一个 `evolve` 调用可以为同一拆分前序下两个已建立 successor 写入不同 summary，并保持完整拆分闭包。
- 一个 `evolve` 调用可以维护已建立稀疏重划，使不同 successor 保持各自完整关系集合和逐边 summary，并保持连通、完整的重划分量。
- 分组 source 解析后必须属于 selected successor 且在本次命令中唯一；组内摘要只绑定该组关系，重复、未命中、清空冲突、空组和统一/分组模式混用均在零写入状态失败。
- 未提供关系分组的既有统一覆盖命令，以及省略覆盖并保留各 candidate 或已建立记录自身关系的命令，行为保持兼容。
- `--preflight`、历史确认、事务锁、可处理失败恢复、索引重建和最终读回覆盖整个后继事件；历史基线探测使用逐后继最终关系，`relationReview` 展示全部所选后继的完整 before/after，包括未分组、同值与摘要移除结果。
- AI 只读取更新后的 `SKILL.md` 与其关系规则时，能够区分事务成员集合和逐 successor 载荷，并能分别为 candidate 首次拆分、已建立拆分摘要修订和稀疏重划选择合规入口。
- 人类说明不再把特定 definition 升级步骤作为常规维护流程；必要的历史兼容与非法 alignment 恢复仍由固定规则和恢复手册准确承接。
- Decision Records 源码测试、分发 CLI、生成一致性、skill 校验、Decision/Test Evidence 索引检查和仓库统一检查全部通过。

## Affected Owners

| Owner | 本 Change 的责任 |
| --- | --- |
| [`tools/decision-records/src/`](../../tools/decision-records/src/) | CLI 事件解析、逐 successor 领域输入、选择器收敛、事务准备和诊断 |
| [`tools/decision-records/tests/`](../../tools/decision-records/tests/) | 参数、事务、恢复、公开类型与分发 CLI 的行为证据 |
| [`scripts/build/decision-records.ts`](../../scripts/build/decision-records.ts) | 从维护源码同步 bundle、source map 与声明闭包；仅在现有生成边界不能覆盖新类型时修改 |
| [`skills/decision-records/SKILL.md`](../../skills/decision-records/SKILL.md) | Agent 的动作选择、建立与维护流程、读取和验证入口 |
| [`skills/decision-records/references/decision-record-rules.md`](../../skills/decision-records/references/decision-record-rules.md) | 完整 successor 集合、逐 successor 最终关系、摘要绑定和维护事务的固定规则 |
| [`skills/decision-records/references/maintenance-recovery.md`](../../skills/decision-records/references/maintenance-recovery.md) | 异常恢复 owner；只在术语或链接需要随新输入模型调整时修改 |
| [`docs/skills/decision-records.md`](../../docs/skills/decision-records.md) | 面向人类的当前定位、推荐维护路径与异常入口 |
| [`docs/decisions/`](../../docs/decisions/) 与 [`docs/decisions/decision-index.json`](../../docs/decisions/decision-index.json) | 保存逐 successor 完整替换的长期理由，并通过关系事务演进现有完整集合判断 |
| [`docs/test-evidence/`](../../docs/test-evidence/) | 为新增或修改测试入口维护唯一 Case 并同步派生索引 |
