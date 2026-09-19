# Design

本 design 把正式记录的完整直接关系替换定义为共同基础动作，并以事务是否改变生命周期区分 Decision 的两个入口。

## Context

两个领域共享以下关系事实：

- 来源记录拥有自己的完整直接前序集合。
- 关系摘要绑定最终集合中的一条边。
- 预检与提交都需要展示完整 `before` / `after`。
- 最终图是否合法仍由各领域的 relation type、闭合和生命周期规则判断。

## Goals / Non-Goals

目标：

- 正式关系原地修正使用同一命令、输入分组和审核结果。
- 多来源替换保持原子提交和可恢复失败结果。
- Decision `set-relations` 与 `evolve` 通过是否改变生命周期形成唯一选择条件。

范围边界：

- 候选初始关系继续在候选来源中维护，并在 publish 时审核。
- 各领域继续拥有 relation type、图闭合和生命周期约束。
- `set-relations` 的写入范围只包含所选正式 Markdown 与派生索引。

## Decisions

### Intended Change

两个 CLI 采用相同输入模型：

```text
set-relations \
  --source <selector> \
  (--relation <type=target>... | --clear-relations) \
  [--relation-summary <target=summary>...] \
  [--preflight]
```

每个 `--source` 开始一个完整替换分组。每组必须明确使用关系集合或 `--clear-relations`；target 在组内唯一，summary 必须命中该组最终关系。多个 source 在同一请求中形成单一事务。

成功审核结果按规范 source ID 排序，并为每个 source 返回 `phase`、`action`、完整 `before` 和 `after`。预检执行与正式提交相同的准备、图验证和写前保护，但保持零写入。

Decision `set-relations` 只替换已正式建立记录的关系与索引。Decision `evolve` 保留候选建立、后继关系、前序归档与删除组合，并复用相同的关系规范化、摘要绑定和审核结果；其分组参数统一为 `--source`。

### Resulting Impacts

- Decision Records 新增 `set-relations` CLI 与 SDK 请求，并从 `evolve` 提取可复用的关系准备与审核组件。
- Investigation Report 现有入口对齐共同输入、排序、审核结果和诊断分类。
- 两个领域先共享公开协议与行为测试；仅在实现中出现完全相同且无领域语义的纯函数时提取共享组件，图验证始终由领域 owner 执行。
- `evolve` 的 `--relations-for` 由共同 `--source` 取代；公开 parser、help 与测试只保留目标语法。
- 两个 skill、人类入口、生成制品、版本、事务与恢复测试、Test Evidence 同步更新。
- 公共关系维护契约形成或演进一份长期 Decision Record。

## Risks / Trade-offs

| 风险 | 控制 |
| --- | --- |
| 共享协议弱化领域图规则 | 共同层只拥有分组、完整替换和审核形状；最终图验证由领域实现。 |
| Decision 两个入口选择不清 | Skill 只使用一个判断：仅改关系用 `set-relations`，同时改生命周期用 `evolve`。 |
| 多 source 扩大写入范围 | 锁、写前 revision、来源字节校验和恢复 outcome 覆盖完整 selection。 |
| 关系摘要在替换时漂移 | 摘要只绑定最终集合中的边，审核结果完整显示退出与新增关系。 |

## Open Questions

无。

## Implementation Observations

- Decision 的关系事务集中在 `decision-relation-transaction-*`、`cli-evolve-relation-groups.ts` 与 relation review 输出；Investigation 已有完整的 `relation-transaction-*`、review 和 CLI relation command 分层。
- 两个领域先对齐请求/审核协议和行为测试。领域图规则、Markdown 投影、锁与恢复继续留在各自工具；只有实现后出现完全相同且无领域语义的纯函数时才提取共享组件。
- 长期方向应建立新的跨领域关系维护 Decision，并修订 `use-strategy-driven-closed-decision-relation-evolution` 与 `260912-support-per-successor-complete-relation-replacements` 对 `evolve` 唯一入口和分组参数的现有判断。
- 现有证据入口包括 `DECISION-EVOLVE-GROUPED-COMPLETE-REPLACEMENT-001`、`DECISION-EVOLVE-GROUPED-RECOVERY-001`、`INVESTIGATION-RELATION-TRANSACTION-ATOMIC-001`、`INVESTIGATION-RELATION-TRANSACTION-REVIEW-001` 与 `INVESTIGATION-RELATION-TRANSACTION-RECOVERY-001`。
