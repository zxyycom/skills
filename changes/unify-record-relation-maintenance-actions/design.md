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
- 被取代的旧参数只进入普通无效参数路径，不保留兼容别名、弃用分支或迁移专用提示。
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

当前无未决问题。

## Implementation Dependencies

实施前先完成 `unify-record-candidate-lifecycle-actions`，并沿用它已经稳定的 `publish`、`reactivate`、
`discard` 与 `evolve` 状态职责；CLI 与 freshness gate 则分别来自更早的
`unify-record-cli-location-and-help` 和 `make-record-index-staleness-actionable`。本 Change 独占关系输入
归一化、关系审核形状和 `evolve --source`，不重新定义候选或生命周期状态转移。
