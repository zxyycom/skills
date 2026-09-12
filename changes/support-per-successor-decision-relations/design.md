# Design

扩展 `evolve` 的关系输入：完整后继集合共同参与一次事务，每个后继可提供不同的完整最终关系。本文承接实现选择与影响，proposal 界定交付范围，tasks 保存执行与验收进度。

## Context

- 当前 CLI 将一个事务级 `DecisionRelationOverride` 应用于全部所选后继，不能维护已建立拆分或重划中不同后继的关系集合与摘要。candidate 可以在各自 Markdown 中声明关系，并在首次建立时省略覆盖。
- [固定关系规则](../../skills/decision-records/references/decision-record-rules.md#后继集合与语义闭合)拥有拆分、重划的完整成员与拓扑约束；本 Change 只扩展输入，不改变这些约束。
- [关系核对规则](../../skills/decision-records/references/decision-record-rules.md#完整替换与摘要绑定)及[摘要消费决策](../../docs/decisions/separate-relation-summary-consumption-by-reading-task.md)已经建立 `relationReview` 的完整 before/after 与 preflight/committed 边界，分组输入继续使用同一输出路径。
- 运行时源码位于 `tools/decision-records/src/`；分发 CLI 与声明由 `scripts/build/decision-records.ts` 生成。当前工具与 active decisions 的审计见 tasks 的 Readiness，Git 基线由 `.change-plan.json` 保存。

## Goals / Non-Goals

目标：让合法的逐后继关系集合能够通过公开 CLI 输入，在同一闭合事务中审核、写入、恢复和读回；原有统一覆盖与候选来源模式保持兼容。

边界：保持关系类型、摘要格式、索引结构、生命周期和闭合策略不变；不增加逐边或摘要 patch、旁路写入、历史摘要批量回填。文档只整理 proposal 列出的直接使用路径。

## Decisions

### Intended Change

#### 事务成员与最终关系

`successor` 是所选后继，也是关系的 source；`predecessor` 是关系指向的前序 target。两类集合分别表达：

| 集合 | 责任 |
| --- | --- |
| `--successor` 选择集 | 显式选择本次闭合事件的完整后继集合，包含关系不变的后继。 |
| 每个后继的最终 relations | 来自该后继权威 Markdown 的完整原值，或本次为其提供的完整 replacement。 |

不同后继可以有不同载荷，但最终组合仍须满足关系策略。例如拆分仍要求各后继仅有一条指向同一前序的拆分边；稀疏重划允许各后继指向不同前序。完整替换不合并新旧数组，新集合未提供 summary 的边移除旧摘要。

#### CLI 分组

`evolve` 新增可重复的 `--relations-for <successor-selector>`。该选项开始一个组，直到下一个同名选项或命令结束；只有 `--relation`、`--relation-summary`、`--clear-relations` 按当前组归属，其他选项继续作用于整个命令。

| 输入模式 | 最终关系来源 |
| --- | --- |
| 不提供关系选项 | 每个所选后继保留自身完整关系；候选首次建立优先使用此路径。 |
| 无分组，提供 `--relation` 与可选摘要 | 同一完整 replacement 应用于全部所选后继。 |
| 无分组，提供 `--clear-relations` | 全部所选后继使用空集合，仍受最终图约束。 |
| 使用分组 | 每组完整替换一个所选后继；未分组后继保留原值。组内可以用 `--clear-relations` 显式提供空集合。 |

以下为实施后的命令示例。A、B 是同一前序的两个已建立拆分后继，所填 alignment 必须与各自当前记录一致：

```text
bun run decision-records -- evolve \
  --successor aligned=successor-a \
  --successor unaligned=successor-b \
  --relations-for successor-a \
  --relation 拆分=coarse-predecessor \
  --relation-summary coarse-predecessor=承接当前已落地边界 \
  --relations-for successor-b \
  --relation 拆分=coarse-predecessor \
  --relation-summary coarse-predecessor=承接仍面向未来的边界 \
  --preflight
```

组内契约：

1. 每组提供至少一个 `--relation`，或一个 `--clear-relations`；空组、仅摘要、clear 与 relation/summary 混用均非法。
2. source、relation target 和 summary target 按现有 selector 规则解析为 Decision ID。组 source 必须属于所选后继，并在解析后唯一；同组 relation target、summary target 分别唯一，summary 必须命中该组关系。
3. summary 可以位于组内 relation 前后；按首个 `=` 分隔，后续 `=` 属于摘要。不同组可以对同一 target 提供不同摘要。
4. 分组模式和统一覆盖模式互斥。命令出现分组时，首组之前的任何关系选项均非法；未分组后继只保留自身关系，不接收统一默认 replacement。

#### 解析与领域输入

CLI 保留关系选项的 argv 事件顺序，包括现有 `--option=value` 写法；先完成分组，再解析 source/target 并绑定摘要。解析后的 `DecisionSuccessor` 增加可选 `relationOverride`；送入事务时只携带规范 ID 与已绑定的完整关系。

保留现有事务级 override，按以下映射兼容旧调用：

| 调用输入 | 事务级 override | 后继级 override |
| --- | --- | --- |
| 来源模式 | `source` | 全部省略 |
| 统一覆盖 | `replace`（含空集合） | 全部省略 |
| CLI 分组 | `source` | 有组者为 `replace`，未分组者省略 |

领域准备使用默认值规则：`successor.relationOverride ?? transaction.relationOverride`。后继级显式 `source` 表示保留原值，显式空 `replace` 表示清空，都不回退。直接领域调用同时提供两级 override 时，后继级完整覆盖优先；这是内部组合规则，不是 CLI 的混合模式，也不合并关系。

CLI 是公开操作入口；新增可选类型随现有公共类型导出机械生成，不另行公开 lifecycle 实现或新建 SDK。分组解析归 Decision Records，摘要规范化与绑定复用现有 owner，不因其他领域存在相似语法而抽取共享协议。

#### 单次事务、历史门禁与核对输出

1. 为全部所选后继计算最终关系。历史基线需求探测和事务准备使用相同有效 override 规则，避免逐后继新增的前序被历史检查遗漏。
2. 沿现有事务 owner 恢复直接前序、检查操作冲突、选择策略、投影最终图并校验形状与闭合，再完成历史确认和整体变更计划；不重排无关事务阶段。
3. 正式执行继续使用集合锁、锁内重新读取与准备、可恢复写入、索引重建和最终读回。各组不独立提交；preflight 仅预演，正式命令重新提供完整参数并验证。
4. `relationReview` 覆盖全部所选后继，包括未分组和同值的后继。按 source ID 保留完整 before/after、`establish`/`replace`/`unchanged` 及摘要移除结果；预检为 `preflight`，正式成功为 `committed`，失败不输出成功 review。不新增 JSON 输出协议或把 review 当作提交凭据。

诊断分层保持既有退出码：

| 阶段 | 失败条件 | 结果 |
| --- | --- | --- |
| 参数解析 | 首组前关系选项、空组、原始重复 source/target、clear 冲突、摘要形状错误 | 退出 `2`，零写入。 |
| 集合解析与领域预演 | selector 不存在或歧义、解析后重复、source 未选择、摘要未命中、alignment 不匹配、形状或闭合错误 | 退出 `1`，零写入。 |
| 历史确认、锁与写入 | 沿用既有 attention、mutation outcome 和恢复诊断 | 不把写入后失败声称为零写入，按实际恢复边界交付。 |

#### 文档与长期决策

- `SKILL.md` 承接动作选择，固定规则承接完整成员、逐后继关系和维护约束，CLI help 承接精确参数。先展示推荐输入对照，再集中说明无效组合与恢复入口。
- 人类说明以“严格检查 → 按诊断恢复 → 复验”为常规维护主线；移除特定 alignment definition 升级步骤。持续有效的 legacy ID、非法 alignment 与索引恢复责任保留在固定规则和恢复手册。
- 新建自包含后继决策，以带摘要的“修订”关系指向 `replace-decision-relations-as-complete-sets`：记录从统一覆盖扩展为逐后继完整覆盖的理由，同时保留完整替换、字段保护与闭合边界。通过正式 CLI 建立并归档前序；按完整方向的落地事实确定 alignment。
- 后继承接输入与完整替换判断，不接管[统一事务](../../docs/decisions/use-strategy-driven-closed-decision-relation-evolution.md)、[拆分](../../docs/decisions/use-closed-splits-for-single-predecessor-decisions.md)或[重划](../../docs/decisions/support-closed-reallocation-of-decision-owners.md)的策略 owner。前序移动后修复受影响的 Markdown 链接，区分当前依据与历史引用，不批量重写历史正文。

### Resulting Impacts

| 受影响边界 | 实施与验证责任 |
| --- | --- |
| CLI → 领域输入 | 顺序分组、selector 收敛、摘要绑定和诊断一并测试；原始错误与读取后才能确定的错误分别验证退出码。 |
| 历史探测 → 事务准备 → 输出 | 重点核对 `cli-lifecycle-selection.ts`、`decision-relation-transaction-successors.ts`、`decision-relation-transaction-support.ts` 与 `decision-relation-transaction.ts`，保证各阶段使用同一逐后继最终集合，并覆盖分组前序历史门禁、review 与失败恢复。 |
| 源码 → 分发制品 | 在实施基线当前版本上递增 skill version，运行 `sync:decision-records-cli` 生成 bundle、source map 和声明闭包，再检查漂移。只有生成链确需调整时才改 build adapter。 |
| 长期决策与测试证据 | 决策通过正式维护入口同步索引；新增或修改的最小原生测试入口按 [Test Evidence Review](../../skills/test-evidence-review/SKILL.md)维护唯一 Case 并同步派生索引。 |
| 文档消费 | 实现者仅凭 Change 与引用 owner 能恢复输入、兼容、事务和验收；使用者仅凭更新后的 skill 与规则能选择候选来源、统一覆盖或逐后继分组。必要失败条件保留，重复说明合并，标题与表格按同一用途分层。 |

## Risks / Trade-offs

- 分组依赖参数顺序：help 标明组起点，测试覆盖关系选项顺序、等号写法及跨组重复 target。
- 兼容路径与分组路径并存：CLI 用互斥模式消除默认 replacement 的歧义；内部默认值按本文显式规则验证。
- 完整 replacement 可能移除未提供的摘要：以完整 before/after 核对，不增加摘要继承或 patch。
- 文档与生成物容易先于实现宣称能力：同一交付中同步源码、行为 owner、生成制品、决策和测试证据；本 Plan 的审计通过不等于功能完成。

## Open Questions

无。
